import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.types';

@Injectable()
export class S3HealthIndicator extends HealthIndicator {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
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

  async isHealthy(key = 's3'): Promise<HealthIndicatorResult> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'S3 health check failed',
        this.getStatus(key, false, { message: error?.message ?? 'Unknown' }),
      );
    }
  }
}
