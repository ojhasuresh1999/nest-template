import { Global, Module } from '@nestjs/common';
import { S3HelperService } from '../helpers/s3/s3.helper';
import { S3UrlRewriteInterceptor } from '../interceptors/s3-url-rewrite.interceptor';

@Global()
@Module({
  providers: [S3HelperService, S3UrlRewriteInterceptor],
  exports: [S3HelperService, S3UrlRewriteInterceptor],
})
export class S3Module {}
