import { HydratedDocument, Types } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { SchemaFactory } from '@nestjs/mongoose';
import { User } from '../../user/schemas/user.schema';

@SchemaWith({ collection: 'device_sessions' })
export class DeviceSession {
  @PropData({
    type: Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @PropData({ required: true, index: true })
  deviceId: string;

  @PropData({ required: true })
  deviceName: string;

  @PropData({ required: true })
  deviceType: string;

  @PropData({ required: true })
  ipAddress: string;

  @PropData({ required: true })
  userAgent: string;

  @PropData({ default: '' })
  location: string;

  @PropData({ default: '' })
  browserName: string;

  @PropData({ default: '' })
  browserVersion: string;

  @PropData({ default: '' })
  osName: string;

  @PropData({ default: '' })
  osVersion: string;

  @PropData({ default: '' })
  deviceVendor: string;

  @PropData({ default: '' })
  deviceModel: string;

  @PropData({ type: Number, default: 1 })
  loginCount: number;

  @PropData({ type: Date, default: Date.now })
  firstLoginAt: Date;

  @PropData({ required: true })
  refreshToken: string;

  @PropData({ default: null })
  fcmToken: string;

  @PropData({ type: Date, default: Date.now })
  lastActiveAt: Date;

  @PropData({ type: Date, required: true })
  expiresAt: Date;

  @PropData({ type: Boolean, default: false })
  rememberMe: boolean;

  @PropData({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const DeviceSessionSchema = SchemaFactory.createForClass(DeviceSession);

DeviceSessionSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
DeviceSessionSchema.index({ userId: 1, isActive: 1 });
DeviceSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type DeviceSessionDocument = HydratedDocument<DeviceSession>;
