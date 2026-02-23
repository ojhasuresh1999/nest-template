import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../user/user.module';
import { NotificationUserController } from './notification-user.controller';
import { NotificationProcessor } from './notification.processor';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { Notification, NotificationSchema } from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    UserModule,
  ],
  controllers: [NotificationUserController],
  providers: [NotificationService, NotificationRepository, NotificationProcessor],
  exports: [NotificationService],
})
export class NotificationModule {}
