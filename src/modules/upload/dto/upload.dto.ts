import { ApiProperty } from '@nestjs/swagger';

export class UploadMediaDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Media files (images/videos) to upload',
  })
  media: any[];
}
