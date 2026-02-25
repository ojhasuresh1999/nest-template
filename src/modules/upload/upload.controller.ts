import { Controller, HttpCode, HttpStatus, Post, Req, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiStandardResponse } from 'src/common/decorators/api-standard-response.decorator';
import { MultiSharpS3Interceptor } from 'src/common/interceptors/sharpS3File.interceptor';
import { UploadMediaDto } from './dto/upload.dto';
import { UploadService } from './upload.service';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.types';

@ApiTags('Upload')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
@Controller({ path: 'upload', version: '1' })
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  @Post('')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload media files',
    description:
      'Uploads images or videos to S3. Use the `folder` query param to organize files into folders (e.g., users, ratings, services).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadMediaDto })
  @ApiQuery({
    name: 'folder',
    required: false,
    description:
      'Target folder/directory in S3 (e.g., users, ratings, services). Defaults to "media".',
    example: 'users',
  })
  @ApiStandardResponse({ status: 200, description: 'Media uploaded successfully' })
  @UseInterceptors(MultiSharpS3Interceptor([{ name: 'media', directory: 'media', maxCount: 10 }]))
  async uploadMedia(@Req() req: Request) {
    const keys = this.uploadService.getUploadedKeys(req);
    const mediaKeys = keys['media'] || [];

    return {
      message: 'Media uploaded successfully',
      mediaKeys,
      fileUrls: mediaKeys.map(
        (key) =>
          `${this.configService.getOrThrow('s3.awsDomainUrl', { infer: true })}/${this.configService.getOrThrow('s3.awsS3Bucket', { infer: true })}/${key}`,
      ),
    };
  }
}
