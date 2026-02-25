import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.types';
import { CircuitBreakerService } from '../../../common/circuit-breaker';
import CircuitBreaker from 'opossum';

@Injectable()
export class S3HelperService implements OnModuleInit {
  private s3!: S3Client;
  private bucket!: string;
  private domainUrl!: string;

  private readonly logger = new Logger(S3HelperService.name);
  private breaker!: CircuitBreaker;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly cbService: CircuitBreakerService,
  ) {}

  onModuleInit() {
    this.initS3();
    this.breaker = this.cbService.create('s3', (cmd: any) => this.s3.send(cmd), {
      timeout: 8000,
      resetTimeout: 15000,
    });
  }

  private initS3() {
    const region = this.configService.getOrThrow('s3.awsRegion', { infer: true });
    const endpoint = this.configService.getOrThrow('s3.awsDomainUrl', { infer: true });
    const accessKeyId = this.configService.getOrThrow('s3.awsAccessKeyId', { infer: true });
    const secretAccessKey = this.configService.getOrThrow('s3.awsSecretAccessKey', { infer: true });

    this.s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucket = this.configService.getOrThrow('s3.awsS3Bucket', { infer: true });
    this.domainUrl = endpoint.replace(/\/+$/, '');
  }

  // ─── URL Construction ────────────────────────────────────────────────

  /**
   * Build a full CDN URL from relative S3 key.
   * @example buildUrl('media/uuid.jpg') → 'https://cdn.example.com/bucket/media/uuid.jpg'
   */
  buildUrl(key: string): string {
    if (!key) return '';
    // If it's already a full URL, return as-is
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return `${this.domainUrl}/${this.bucket}/${key}`;
  }

  /**
   * Extract the relative S3 key from a full URL.
   * Strips the domain and bucket prefix.
   * @example extractKey('https://cdn.example.com/bucket/media/uuid.jpg') → 'media/uuid.jpg'
   */
  extractKey(url: string): string {
    if (!url) return '';
    // If it doesn't look like a URL, assume it's already a key
    if (!url.startsWith('http://') && !url.startsWith('https://')) return url;

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      // Skip the bucket name (first path segment) and join the rest
      if (pathParts.length < 2) return url;
      return pathParts.slice(1).join('/');
    } catch {
      this.logger.warn(`Could not parse URL to extract key: ${url}`);
      return url;
    }
  }

  // ─── Key-Based Operations ────────────────────────────────────────────

  /**
   * Check if a file exists in S3 by its key (not full URL).
   * Uses HeadObjectCommand which is efficient (doesn't download the file).
   */
  async fileExistsByKey(bucket: string, key: string): Promise<boolean> {
    if (!key) return false;

    try {
      await this.breaker.fire(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.debug(`File not found in S3: ${key}`);
        return false;
      }
      this.logger.error(`Error checking S3 file existence: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete a file from S3 by its key (not full URL).
   * @returns true if deletion was successful or file didn't exist, false on error
   */
  async deleteFileByKey(bucket: string, key: string): Promise<boolean> {
    if (!key) {
      this.logger.debug('No key provided for deletion, skipping.');
      return true;
    }

    try {
      await this.breaker.fire(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      this.logger.log(`Successfully deleted file from S3: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${key}`, error);
      return false;
    }
  }

  // ─── URL-Based Operations (backward compatible) ──────────────────────

  /**
   * Extracts bucket and key from a full S3 URL.
   * Supports formats like: http://domain/bucket/key or https://bucket.s3.region.amazonaws.com/key
   */
  private extractKeyFromUrl(url: string): { bucket: string; key: string } | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      if (pathParts.length < 2) {
        this.logger.warn(`Could not extract key from URL: ${url}`);
        return null;
      }

      // For MinIO-style URLs: /bucket/path/to/file
      const bucket = pathParts[0];
      const key = pathParts.slice(1).join('/');

      return { bucket, key };
    } catch (error) {
      this.logger.error(`Invalid URL format: ${url}`, error);
      return null;
    }
  }

  /**
   * Delete a file from S3 given its full URL.
   * @param url The full URL of the file to delete
   * @returns true if deletion was successful or file didn't exist, false on error
   */
  async deleteFile(url: string): Promise<boolean> {
    if (!url) {
      this.logger.debug('No URL provided for deletion, skipping.');
      return true;
    }

    // If it's a relative key, use the default bucket
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return this.deleteFileByKey(this.bucket, url);
    }

    const extracted = this.extractKeyFromUrl(url);
    if (!extracted) {
      this.logger.warn(`Could not parse S3 URL for deletion: ${url}`);
      return false;
    }

    return this.deleteFileByKey(extracted.bucket, extracted.key);
  }

  /**
   * Check if a file exists in S3 given its full URL.
   * Uses HeadObjectCommand which is efficient (doesn't download the file).
   * @param url The full URL of the file to check
   * @returns true if file exists, false if not found or on error
   */
  async fileExists(url: string): Promise<boolean> {
    if (!url) {
      this.logger.debug('No URL provided for existence check.');
      return false;
    }

    // If it's a relative key, use the default bucket
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return this.fileExistsByKey(this.bucket, url);
    }

    const extracted = this.extractKeyFromUrl(url);
    if (!extracted) {
      this.logger.warn(`Could not parse S3 URL for existence check: ${url}`);
      return false;
    }

    return this.fileExistsByKey(extracted.bucket, extracted.key);
  }

  /**
   * Delete multiple files from S3.
   * Accepts both full URLs and relative keys.
   * @param urls Array of full URLs or keys to delete
   * @returns Object with successCount and failureCount
   */
  async deleteFiles(urls: string[]): Promise<{ successCount: number; failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;

    for (const url of urls) {
      const success = await this.deleteFile(url);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return { successCount, failureCount };
  }
}
