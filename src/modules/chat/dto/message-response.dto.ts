import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageStatus, MessageType } from '../schemas/message.schema';

class SenderSummary {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  profileImage?: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  conversation: string;

  @ApiProperty({ type: SenderSummary })
  sender: SenderSummary;

  @ApiProperty({ example: '507f1f77bcf86cd799439013' })
  receiver: string;

  @ApiProperty({ example: 'Hello, how are you?' })
  content: string;

  @ApiProperty({ enum: MessageType, example: MessageType.TEXT })
  messageType: MessageType;

  @ApiProperty({ enum: MessageStatus, example: MessageStatus.SENT })
  status: MessageStatus;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z' })
  readAt?: Date;

  @ApiPropertyOptional({ example: '2024-01-15T10:29:00.000Z' })
  deliveredAt?: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata for file/image messages',
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({ example: '2024-01-15T10:28:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Client-side temporary ID for optimistic updates',
    example: 'temp-123456',
  })
  tempId?: string;
}

export class MessagesListResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  messages: MessageResponseDto[];

  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: true })
  hasMore: boolean;
}

export class MessageSentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: MessageResponseDto })
  message: MessageResponseDto;
}

export class MarkReadResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    description: 'Number of messages marked as read',
    example: 5,
  })
  count: number;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  conversationId: string;
}
