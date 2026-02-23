import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationProcessor } from './notification.processor';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    UserModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository, NotificationProcessor],
  exports: [NotificationService],
})
export class NotificationModule {}
