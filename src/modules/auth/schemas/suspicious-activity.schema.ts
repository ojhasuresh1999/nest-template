import { HydratedDocument, Types } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { SchemaFactory } from '@nestjs/mongoose';

export enum SuspiciousActivityType {
  FAILED_LOGIN = 'FAILED_LOGIN',
  NEW_DEVICE = 'NEW_DEVICE',
  MULTIPLE_LOCATIONS = 'MULTIPLE_LOCATIONS',
  TOKEN_REUSE = 'TOKEN_REUSE',
  BRUTE_FORCE = 'BRUTE_FORCE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  UNUSUAL_TIME = 'UNUSUAL_TIME',
}

export enum SeverityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@SchemaWith({ collection: 'suspicious_activities' })
export class SuspiciousActivity {
  @PropData({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @PropData({ required: false, index: true })
  identifier: string;

  @PropData({
    required: true,
    enum: SuspiciousActivityType,
    index: true,
  })
  activityType: SuspiciousActivityType;

  @PropData({
    required: true,
    enum: SeverityLevel,
    default: SeverityLevel.LOW,
    index: true,
  })
  severity: SeverityLevel;

  @PropData({ required: true })
  ipAddress: string;

  @PropData({ required: true })
  userAgent: string;

  @PropData({ default: '' })
  location: string;

  @PropData({ type: Object, default: {} })
  details: Record<string, unknown>;

  @PropData({ type: Boolean, default: false, index: true })
  isResolved: boolean;

  @PropData({ type: Date })
  resolvedAt: Date;

  @PropData({ type: String })
  resolvedBy: string;

  @PropData({ type: String })
  resolutionNotes: string;
}

export const SuspiciousActivitySchema = SchemaFactory.createForClass(SuspiciousActivity);

SuspiciousActivitySchema.index({ createdAt: -1 });
SuspiciousActivitySchema.index({ userId: 1, activityType: 1 });
SuspiciousActivitySchema.index({ identifier: 1, activityType: 1 });

export type SuspiciousActivityDocument = HydratedDocument<SuspiciousActivity>;
