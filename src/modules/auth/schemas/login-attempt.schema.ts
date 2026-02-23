import { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { SchemaFactory } from '@nestjs/mongoose';

@SchemaWith({ collection: 'login_attempts' })
export class LoginAttempt {
  @PropData({ required: true, index: true })
  identifier: string;

  @PropData({ required: true, index: true })
  ipAddress: string;

  @PropData({ type: Number, default: 0 })
  attempts: number;

  @PropData({ type: Date, default: Date.now })
  lastAttemptAt: Date;

  @PropData({ type: Date })
  lockedUntil: Date;
}

export const LoginAttemptSchema = SchemaFactory.createForClass(LoginAttempt);

LoginAttemptSchema.index({ identifier: 1, ipAddress: 1 }, { unique: true });
LoginAttemptSchema.index(
  { lockedUntil: 1 },
  {
    expireAfterSeconds: 86400,
    partialFilterExpression: { lockedUntil: { $exists: true } },
  },
);

export type LoginAttemptDocument = HydratedDocument<LoginAttempt>;
