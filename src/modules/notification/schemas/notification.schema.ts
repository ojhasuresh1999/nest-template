import { SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { User } from '../../user/schemas/user.schema';
import { softDeletePlugin } from '../../../common/plugins/soft-delete.plugin';

export enum NotificationType {
  SYSTEM = 'SYSTEM',
  PROMOTION = 'PROMOTION',
  ORDER = 'ORDER',
  CHAT = 'CHAT',
  ALERT = 'ALERT',
}

@SchemaWith({ collection: 'notifications' })
export class Notification {
  @PropData({ required: true, index: true })
  title: string;

  @PropData({ required: true })
  body: string;

  @PropData({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId: mongoose.Types.ObjectId;

  @PropData({ type: Boolean, default: false, index: true })
  isRead: boolean;

  @PropData({
    type: String,
    enum: NotificationType,
    default: NotificationType.SYSTEM,
    index: true,
  })
  type: NotificationType;

  @PropData({ type: mongoose.Schema.Types.Mixed, default: {} })
  metadata: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

NotificationSchema.plugin(softDeletePlugin);

export type NotificationDocument = HydratedDocument<Notification>;
