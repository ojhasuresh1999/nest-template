import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AllConfigType } from 'src/config/config.types';

/**
 * Known field names that store S3 object keys.
 * The interceptor will prepend the CDN base URL to these fields.
 */
const S3_KEY_FIELDS = new Set([
  'profileImage',
  'serviceListImage',
  'serviceImage',
  'categoryImage',
  'offerImage',
  'ratingImages',
  'fileUrl',
  'mediaUrls',
  'coverImage',
  'bannerImage',
  'thumbnail',
  'avatar',
  'image',
  'images',
  'logo',
]);

@Injectable()
export class S3UrlRewriteInterceptor implements NestInterceptor {
  private baseUrl!: string;

  private readonly logger = new Logger(S3UrlRewriteInterceptor.name);

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  private getBaseUrl(): string {
    if (!this.baseUrl) {
      const domain = this.configService.getOrThrow('s3.awsDomainUrl', { infer: true });
      const bucket = this.configService.getOrThrow('s3.awsS3Bucket', { infer: true });
      this.baseUrl = `${domain.replace(/\/+$/, '')}/${bucket}`;
    }
    return this.baseUrl;
  }

  /**
   * Check if a value looks like it's already a full URL
   */
  private isFullUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
  }

  /**
   * Prepend the CDN base URL to a relative S3 key.
   * If the value is already a full URL, return it unchanged.
   * If the value is empty or not a string, return it unchanged.
   */
  private rewriteValue(value: unknown): unknown {
    if (typeof value !== 'string' || !value || value.trim() === '') {
      return value;
    }

    if (this.isFullUrl(value)) {
      return value;
    }

    return `${this.getBaseUrl()}/${value}`;
  }

  /**
   * Recursively traverse an object/array and rewrite known S3 key fields.
   * Uses an iterative approach with a stack to avoid stack overflow on deep objects.
   */
  private rewriteObject(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.rewriteObject(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (S3_KEY_FIELDS.has(key)) {
        if (Array.isArray(value)) {
          result[key] = value.map((v) => this.rewriteValue(v));
        } else {
          result[key] = this.rewriteValue(value);
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.rewriteObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        try {
          return this.rewriteObject(data);
        } catch (error) {
          this.logger.warn('Failed to rewrite S3 URLs in response', error);
          return data;
        }
      }),
    );
  }
}
