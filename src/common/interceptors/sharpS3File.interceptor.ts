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

enum FileCategory {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

interface FileCategoryConfig {
  mimeTypes: Set<string>;
  extensions: Set<string>;
  maxSizeBytes: number;
  s3Directory: string;
}

const FILE_CATEGORIES: Record<FileCategory, FileCategoryConfig> = {
  [FileCategory.IMAGE]: {
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
    extensions: new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']),
    maxSizeBytes: 10 * 1024 * 1024,
    s3Directory: 'images',
  },
  [FileCategory.VIDEO]: {
    mimeTypes: new Set(['video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime']),
    extensions: new Set(['.mp4', '.mpeg', '.ogv', '.webm', '.mov']),
    maxSizeBytes: 5 * 1024 * 1024 * 1024,
    s3Directory: 'videos',
  },
  [FileCategory.AUDIO]: {
    mimeTypes: new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac']),
    extensions: new Set(['.mp3', '.wav', '.ogg', '.aac']),
    maxSizeBytes: 50 * 1024 * 1024,
    s3Directory: 'audio',
  },
  [FileCategory.DOCUMENT]: {
    mimeTypes: new Set([
      'application/pdf',
      'text/csv',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/x-zip-compressed',
    ]),
    extensions: new Set([
      '.pdf',
      '.csv',
      '.txt',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.zip',
    ]),
    maxSizeBytes: 50 * 1024 * 1024, // 50 MB
    s3Directory: 'documents',
  },
};

const ALL_ALLOWED_MIMES = new Set(Object.values(FILE_CATEGORIES).flatMap((c) => [...c.mimeTypes]));
const ALL_ALLOWED_EXTENSIONS = new Set(
  Object.values(FILE_CATEGORIES).flatMap((c) => [...c.extensions]),
);
const GLOBAL_MAX_FILE_SIZE = Math.max(...Object.values(FILE_CATEGORIES).map((c) => c.maxSizeBytes));

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 90;

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
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
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

  private classifyFile(file: Express.Multer.File): FileCategory {
    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
      if (config.mimeTypes.has(file.mimetype)) return category as FileCategory;
    }
    throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
  }

  private validateFile(file: Express.Multer.File) {
    const ext = extname(file.originalname).toLowerCase();

    if (!ALL_ALLOWED_MIMES.has(file.mimetype) || !ALL_ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype} (${ext})`);
    }

    const category = this.classifyFile(file);
    const config = FILE_CATEGORIES[category];
    if (file.size > config.maxSizeBytes) {
      const maxMB = Math.round(config.maxSizeBytes / (1024 * 1024));
      throw new BadRequestException(`${category} file exceeds maximum size of ${maxMB} MB`);
    }
  }

  private buildDatePartitionedKey(directory: string, ext: string): string {
    const d = new Date();
    return `${directory}/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}/${randomUUID()}${ext}`;
  }

  private computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private computeChunkedFingerprint(buffer: Buffer, chunkSize = 10 * 1024 * 1024): string {
    const size = buffer.length;
    const start = buffer.subarray(0, Math.min(chunkSize, size));
    const end = buffer.subarray(Math.max(0, size - chunkSize), size);

    const hash = createHash('sha256');
    hash.update(start);
    hash.update(end);
    hash.update(size.toString());
    return hash.digest('hex');
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^\w.\-]/g, '_');
  }

  private async checkDeduplication(redisKey: string, label: string): Promise<string | null> {
    const cached = await this.redis.get(redisKey);
    if (!cached) return null;

    const exists = await this.s3Helper.fileExistsByKey(this.bucket, cached);
    if (exists) {
      this.logger.verbose(`${label} cached and verified. Skipping upload.`);
      return cached;
    }

    this.logger.warn(`Stale cache for ${label}. Invalidating and re-uploading.`);
    await this.redis.del(redisKey);
    return null;
  }

  private cacheKey(redisKey: string, s3Key: string): void {
    this.redis.set(redisKey, s3Key, 'EX', CACHE_TTL_SECONDS).catch(() => null);
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
      .rotate()
      .webp({ quality: 80 })
      .toBuffer();
  }

  private async uploadImage(file: Express.Multer.File, directory: string): Promise<string> {
    const hash = this.computeHash(file.buffer);
    const dedupKey = `img:dedupe:${hash}`;

    const cached = await this.checkDeduplication(dedupKey, file.originalname);
    if (cached) return cached;

    const processed = await this.processImage(file.buffer);
    const key = `${directory}/${randomUUID()}.webp`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    this.cacheKey(dedupKey, key);
    this.logger.debug(`Image uploaded → ${key}`);
    return key;
  }

  // ─── Video Upload (Multipart) ───────────────────────────────────────────

  private async uploadVideo(file: Express.Multer.File, directory: string): Promise<string> {
    const fingerprint = this.computeChunkedFingerprint(file.buffer);
    const dedupKey = `video:dedupe:${fingerprint}`;

    const cached = await this.checkDeduplication(dedupKey, file.originalname);
    if (cached) return cached;

    const ext = extname(file.originalname).toLowerCase();
    const key = this.buildDatePartitionedKey(directory, ext);

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: Readable.from(file.buffer),
        ContentType: file.mimetype,
        ContentDisposition: `inline; filename="${this.sanitizeFilename(file.originalname)}"`,
        CacheControl: 'public, max-age=31536000, immutable',
      },
      partSize: 10 * 1024 * 1024,
      queueSize: 4,
    });

    await upload.done();

    this.cacheKey(dedupKey, key);
    this.logger.debug(`Video uploaded → ${key}`);
    return key;
  }

  private async uploadAudio(file: Express.Multer.File, directory: string): Promise<string> {
    const hash = this.computeHash(file.buffer);
    const dedupKey = `audio:dedupe:${hash}`;

    const cached = await this.checkDeduplication(dedupKey, file.originalname);
    if (cached) return cached;

    const ext = extname(file.originalname).toLowerCase();
    const key = this.buildDatePartitionedKey(directory, ext);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: `inline; filename="${this.sanitizeFilename(file.originalname)}"`,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    this.cacheKey(dedupKey, key);
    this.logger.debug(`Audio uploaded → ${key}`);
    return key;
  }

  private async uploadDocument(file: Express.Multer.File, directory: string): Promise<string> {
    const hash = this.computeHash(file.buffer);
    const dedupKey = `doc:dedupe:${hash}`;

    const cached = await this.checkDeduplication(dedupKey, file.originalname);
    if (cached) return cached;

    const ext = extname(file.originalname).toLowerCase();
    const key = this.buildDatePartitionedKey(directory, ext);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: `attachment; filename="${this.sanitizeFilename(file.originalname)}"`,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    this.cacheKey(dedupKey, key);
    this.logger.debug(`Document uploaded → ${key}`);
    return key;
  }

  private async uploadFile(file: Express.Multer.File, directory: string): Promise<string> {
    const category = this.classifyFile(file);

    switch (category) {
      case FileCategory.IMAGE:
        return this.uploadImage(file, directory);
      case FileCategory.VIDEO:
        return this.uploadVideo(file, directory);
      case FileCategory.AUDIO:
        return this.uploadAudio(file, directory);
      case FileCategory.DOCUMENT:
        return this.uploadDocument(file, directory);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.initS3();
    this.initRedis();

    const req = context.switchToHttp().getRequest<Request>();

    const dynamicFolder = (req.query?.folder as string)?.replace(/[^a-zA-Z0-9_\-\/]/g, '') || '';

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: GLOBAL_MAX_FILE_SIZE },
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

            const directory = dynamicFolder || field.directory;
            result[field.name] = [];

            for (const file of files) {
              result[field.name].push(await this.uploadFile(file, directory));
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
