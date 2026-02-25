import { SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { User } from '../../user/schemas/user.schema';
import { Conversation } from './conversation.schema';
import { softDeletePlugin } from '../../../common/plugins/soft-delete.plugin';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
}

@SchemaWith({ collection: 'messages' })
export class Message {
  @PropData({
    type: mongoose.Schema.Types.ObjectId,
    ref: Conversation.name,
    required: true,
    index: true,
  })
  conversation: mongoose.Types.ObjectId;

  @PropData({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  sender: mongoose.Types.ObjectId;

  @PropData({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  receiver: mongoose.Types.ObjectId;

  @PropData({ type: String, required: true, maxlength: 5000 })
  content: string;

  @PropData({
    type: String,
    enum: MessageType,
    default: MessageType.TEXT,
  })
  messageType: MessageType;

  @PropData({
    type: String,
    enum: MessageStatus,
    default: MessageStatus.SENT,
    index: true,
  })
  status: MessageStatus;

  @PropData({ type: Date, default: null })
  readAt: Date | null;

  @PropData({ type: Date, default: null })
  deliveredAt: Date | null;

  @PropData({ type: Boolean, default: false })
  isDeleted: boolean;

  /**
   * Optional metadata for file/image messages
   */
  @PropData({ type: Object, default: null })
  metadata: Record<string, unknown> | null;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes for efficient querying
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, status: 1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ conversation: 1, isDeleted: 1, createdAt: -1 });

MessageSchema.plugin(softDeletePlugin);

export type MessageDocument = HydratedDocument<Message>;
