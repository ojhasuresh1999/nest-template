import { Injectable } from '@nestjs/common';
import { S3HelperService } from 'src/common/helpers/s3/s3.helper';

@Injectable()
export class UploadService {
  constructor(private readonly s3Helper: S3HelperService) {}

  /**
   * Extract uploaded file keys from the request object.
   * Returns a map of field names → arrays of relative S3 keys.
   */
  getUploadedKeys(req: any): Record<string, string[]> {
    return (req as any).uploadedFiles || {};
  }

  /**
   * Build a full CDN URL from a relative S3 key.
   */
  buildUrl(key: string): string {
    return this.s3Helper.buildUrl(key);
  }

  /**
   * Build full CDN URLs for all keys in an uploaded files map.
   * Returns a map of field names → arrays of full URLs.
   */
  buildUrls(keys: Record<string, string[]>): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [field, fieldKeys] of Object.entries(keys)) {
      result[field] = fieldKeys.map((k) => this.s3Helper.buildUrl(k));
    }
    return result;
  }
}
