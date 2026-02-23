import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MessageType } from '../schemas/message.schema';

export class SendMessageDto {
  @ApiPropertyOptional({
    description: 'Conversation ID (optional if receiverId is provided)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  @ApiProperty({
    description: 'Receiver user ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsNotEmpty()
  @IsMongoId()
  receiverId: string;

  @ApiProperty({
    description: 'Message content (text or file URL for image/file messages)',
    example: 'Hello, how are you?',
    maxLength: 5000,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Message type',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({
    description: 'Additional metadata for file/image messages',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Client-side temporary ID for optimistic updates',
    example: 'temp-123456',
  })
  @IsOptional()
  @IsString()
  tempId?: string;
}
