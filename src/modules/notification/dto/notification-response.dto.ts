import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../schemas/notification.schema';

export class NotificationResponseDto {
  @ApiProperty({ example: '65a123...', description: 'Notification ID' })
  _id: string;

  @ApiProperty({ example: 'Welcome', description: 'Notification Title' })
  title: string;

  @ApiProperty({ example: 'Thanks for joining!', description: 'Notification Body' })
  body: string;

  @ApiProperty({ example: false, description: 'Is Read Status' })
  isRead: boolean;

  @ApiProperty({ enum: NotificationType, example: 'SYSTEM', description: 'Notification Type' })
  type: NotificationType;

  @ApiProperty({ example: {}, description: 'Additional Metadata' })
  metadata: Record<string, any>;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', description: 'Creation Timestamp' })
  createdAt: Date;
}
