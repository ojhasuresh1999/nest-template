import { SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { User } from '../../user/schemas/user.schema';

@SchemaWith({ collection: 'conversations' })
export class Conversation {
  @PropData({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: User.name }],
    required: true,
    validate: {
      validator: (v: mongoose.Types.ObjectId[]) => v.length === 2,
      message: 'Conversation must have exactly 2 participants',
    },
  })
  participants: mongoose.Types.ObjectId[];

  @PropData({ type: String, default: '' })
  lastMessage: string;

  @PropData({ type: mongoose.Schema.Types.ObjectId, ref: User.name })
  lastMessageSender: mongoose.Types.ObjectId;

  @PropData({ type: Date, default: Date.now, index: true })
  lastMessageAt: Date;

  /**
   * Stores unread count per user: { "<userId>": count }
   * This allows O(1) lookup for each user's unread messages
   */
  @PropData({ type: Object, default: {} })
  unreadCount: Record<string, number>;

  @PropData({ type: Boolean, default: false })
  isDeleted: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });
ConversationSchema.index({ participants: 1, isDeleted: 1 });

export type ConversationDocument = HydratedDocument<Conversation>;
