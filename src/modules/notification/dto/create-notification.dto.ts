import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '../schemas/notification.schema';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'New Message',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification body/content',
    example: 'You have received a new message from John',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Additional data payload for the notification',
    example: { action: 'OPEN_CHAT', chatId: '123' },
  })
  @IsOptional()
  data?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Type of notification',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
