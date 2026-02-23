import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { Request } from 'express';
import Redis from 'ioredis';
import multer from 'multer';
import { extname } from 'path';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import sharp from 'sharp';
import { AllConfigType } from 'src/config/config.types';
import { S3HelperService } from 'src/common/helpers/s3/s3.helper';
import { Readable } from 'stream';

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  // 'application/pdf',
  // 'text/csv',
  'video/mp4',
  'video/mpeg',
  'video/ogg',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
] as const;

const allowedExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  'webp',
  'avif',
  // '.pdf',
  // '.csv',
  '.mp4',
  '.mpeg',
  '.ogv',
  '.webm',
  '.mov',
  '.mp3',
] as const;

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const videoMimePrefix = 'video/';

export interface FileFieldConfig {
  name: string;
  directory: string;
  maxCount?: number;
}

export type UploadedFilesMap = Record<string, string[]>;

@Injectable()
export class MultiSharpS3InterceptorBase implements NestInterceptor {
  private s3!: S3Client;
  private redis!: Redis;
  private bucket!: string;

  private readonly logger = new Logger(MultiSharpS3InterceptorBase.name);

  constructor(
    private readonly fileFields: FileFieldConfig[],
    private readonly configService: ConfigService<AllConfigType>,
    private readonly s3Helper: S3HelperService,
  ) {}

  private initS3() {
    if (this.s3) return;

    const region = this.configService.getOrThrow('s3.awsRegion', { infer: true });
    const endpoint = this.configService.getOrThrow('s3.awsDomainUrl', { infer: true });
    const accessKeyId = this.configService.getOrThrow('s3.awsAccessKeyId', { infer: true });
    const secretAccessKey = this.configService.getOrThrow('s3.awsSecretAccessKey', { infer: true });

    this.s3 = new S3Client({
      region,
      endpoint, // 🔥 MinIO endpoint
      forcePathStyle: true, // 🔥 REQUIRED for MinIO
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucket = this.configService.getOrThrow('s3.awsS3Bucket', { infer: true });
  }

  private initRedis() {
    if (this.redis) return;

    this.redis = new Redis({
      host: this.configService.getOrThrow('redis.host', { infer: true }),
      port: this.configService.getOrThrow('redis.port', { infer: true }),
      password: this.configService.getOrThrow('redis.password', { infer: true }),
    });
  }

  private validateFile(file: Express.Multer.File) {
    const ext = extname(file.originalname).toLowerCase();
    if (
      !allowedMimeTypes.includes(file.mimetype as any) ||
      !allowedExtensions.includes(ext as any)
    ) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
  }

  private isImage(file: Express.Multer.File) {
    return imageMimeTypes.has(file.mimetype);
  }

  private isVideo(file: Express.Multer.File) {
    return file.mimetype.startsWith(videoMimePrefix);
  }

  private buildVideoKey(ext: string) {
    const d = new Date();
    return `videos/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}/${randomUUID()}${ext}`;
  }

  private async processImage(buffer: Buffer, mimetype: string) {
    const img = sharp(buffer)
      .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
      .rotate();

    return mimetype === 'image/jpeg'
      ? img.jpeg({ quality: 60, progressive: true, mozjpeg: true }).toBuffer()
      : img.png({ compressionLevel: 9 }).toBuffer();
  }

  private computeVideoFingerprint(buffer: Buffer, chunkSize = 10 * 1024 * 1024) {
    const size = buffer.length;

    const start = buffer.subarray(0, Math.min(chunkSize, size));
    const end = buffer.subarray(Math.max(0, size - chunkSize), size);

    const hash = createHash('sha256');
    hash.update(start);
    hash.update(end);
    hash.update(size.toString());

    return hash.digest('hex');
  }

  private async uploadImage(file: Express.Multer.File, directory: string): Promise<string> {
    const hash = createHash('sha256').update(file.buffer).digest('hex');

    const cached = await this.redis.get(hash);
    if (cached) {
      const exists = await this.s3Helper.fileExistsByKey(this.bucket, cached);
      if (exists) {
        this.logger.verbose(`Image ${file.originalname} cached and verified. Skipping upload.`);
        return cached;
      }

      this.logger.warn(
        `Cached image URL is stale (file deleted from S3). Invalidating cache and re-uploading: ${file.originalname}`,
      );
      await this.redis.del(hash);
    }

    return this.performImageUpload(file, directory, hash);
  }

  private async performImageUpload(
    file: Express.Multer.File,
    directory: string,
    hash: string,
  ): Promise<string> {
    const processed = await this.processImage(file.buffer, file.mimetype);
    const key = `${directory}/${randomUUID()}${extname(file.originalname)}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    // Cache the key (not the full URL) for deduplication
    this.redis.set(hash, key, 'EX', 60 * 60 * 24 * 90).catch(() => null);
    this.logger.debug(`Image ${file.originalname} uploaded to S3 as key: ${key}`);

    return key;
  }

  private async uploadVideo(file: Express.Multer.File): Promise<string> {
    const fingerprint = this.computeVideoFingerprint(file.buffer);
    const redisKey = `video:dedupe:${fingerprint}`;

    const cached = await this.redis.get(redisKey);
    if (cached) {
      const exists = await this.s3Helper.fileExistsByKey(this.bucket, cached);
      if (exists) {
        this.logger.verbose(`Video ${file.originalname} cached and verified. Skipping upload.`);
        return cached;
      }

      this.logger.warn(
        `Cached video URL is stale (file deleted from S3). Invalidating cache and re-uploading: ${file.originalname}`,
      );
      await this.redis.del(redisKey);
    }

    return this.performVideoUpload(file, redisKey);
  }

  private async performVideoUpload(file: Express.Multer.File, redisKey: string): Promise<string> {
    const key = this.buildVideoKey(extname(file.originalname));

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: Readable.from(file.buffer),
        ContentType: file.mimetype,
        ContentDisposition: `inline; filename="${file.originalname}"`,
        CacheControl: 'public, max-age=31536000, immutable',
      },
      partSize: 10 * 1024 * 1024,
      queueSize: 4,
    });

    await upload.done();

    this.logger.debug(`Video ${file.originalname} uploaded to S3 as key: ${key}`);
    await this.redis.set(redisKey, key, 'EX', 60 * 60 * 24 * 90);

    return key;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.initS3();
    this.initRedis();

    const req = context.switchToHttp().getRequest<Request>();

    // Support dynamic folder via query param: ?folder=users
    const dynamicFolder = (req.query?.folder as string)?.replace(/[^a-zA-Z0-9_\-\/]/g, '') || '';

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        try {
          this.validateFile(file);
          cb(null, true);
        } catch (e) {
          cb(e as any);
        }
      },
    }).fields(
      this.fileFields.map((f) => ({
        name: f.name,
        maxCount: f.maxCount ?? 10,
      })),
    );

    const uploadPromise = new Promise<void>((resolve, reject) => {
      upload(req, null as any, async (err) => {
        if (err) return reject(err);

        try {
          const result: UploadedFilesMap = {};

          for (const field of this.fileFields) {
            const files = (req.files as any)?.[field.name] ?? [];
            if (!files.length) continue;

            // Use dynamic folder if provided, otherwise fall back to the static field directory
            const directory = dynamicFolder || field.directory;

            result[field.name] = [];

            for (const file of files) {
              if (this.isImage(file)) {
                result[field.name].push(await this.uploadImage(file, directory));
              } else if (this.isVideo(file)) {
                result[field.name].push(await this.uploadVideo(file));
              }
            }
          }

          (req as any).uploadedFiles = result;
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    return from(uploadPromise).pipe(switchMap(() => next.handle()));
  }
}

export function MultiSharpS3Interceptor(fields: FileFieldConfig[]): Type<NestInterceptor> {
  @Injectable()
  class Interceptor extends MultiSharpS3InterceptorBase {
    constructor(configService: ConfigService, s3Helper: S3HelperService) {
      super(fields, configService, s3Helper);
    }
  }

  return Interceptor;
}
