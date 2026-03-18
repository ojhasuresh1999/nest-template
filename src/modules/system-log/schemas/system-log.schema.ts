import { SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

@SchemaWith({ collection: 'system_logs' })
export class SystemLog {
  @PropData({
    type: String,
    enum: LogLevel,
    default: LogLevel.INFO,
    index: true,
  })
  level: string;

  @PropData({ required: true })
  message: string;

  @PropData({ index: true })
  context: string;

  @PropData({ type: Date, index: true })
  timestamp: Date;

  @PropData({ type: mongoose.Schema.Types.Mixed, default: {} })
  meta: Record<string, any>;

  @PropData({ index: true })
  source: string;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);

SystemLogSchema.index({ timestamp: -1 });
SystemLogSchema.index({ level: 1, timestamp: -1 });
SystemLogSchema.index({ context: 1, timestamp: -1 });

export type SystemLogDocument = HydratedDocument<SystemLog>;
