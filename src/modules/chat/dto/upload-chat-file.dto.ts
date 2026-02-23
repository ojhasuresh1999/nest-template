import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadChatFileDto {
  @ApiProperty({
    description: 'Receiver user ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsNotEmpty()
  @IsMongoId()
  receiverId: string;

  @ApiPropertyOptional({
    description: 'Conversation ID (optional, will be created if not provided)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Caption for the file/image',
    example: 'Check out this photo!',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;

  @ApiPropertyOptional({
    description: 'Client-side temporary ID for optimistic updates',
    example: 'temp-file-123456',
  })
  @IsOptional()
  @IsString()
  tempId?: string;
}

export class UploadChatFileResponseDto {
  @ApiProperty({ description: 'File URL in S3' })
  fileUrl: string;

  @ApiProperty({ description: 'Original file name' })
  fileName: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ description: 'MIME type of the file' })
  mimeType: string;

  @ApiProperty({ description: 'Message type (image, file)' })
  messageType: 'image' | 'file';
}
