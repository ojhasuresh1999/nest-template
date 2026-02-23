import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Message, MessageDocument, MessageStatus } from '../schemas/message.schema';

@Injectable()
export class MessageRepository extends BaseRepository<MessageDocument> {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
  ) {
    super(messageModel);
  }

  /**
   * Create a new message
   */
  async createMessage(data: {
    conversation: string | Types.ObjectId;
    sender: string | Types.ObjectId;
    receiver: string | Types.ObjectId;
    content: string;
    messageType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MessageDocument> {
    return this.messageModel.create({
      ...data,
      conversation: new Types.ObjectId(data.conversation),
      sender: new Types.ObjectId(data.sender),
      receiver: new Types.ObjectId(data.receiver),
    });
  }

  /**
   * Get paginated messages for a conversation
   */
  async getConversationMessages(
    conversationId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ messages: MessageDocument[]; total: number; hasMore: boolean }> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({
          conversation: new Types.ObjectId(conversationId),
          isDeleted: false,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'firstName lastName fullName profileImage')
        .exec(),
      this.messageModel.countDocuments({
        conversation: new Types.ObjectId(conversationId),
        isDeleted: false,
      }),
    ]);

    return {
      messages: messages.reverse(),
      total,
      hasMore: skip + messages.length < total,
    };
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<number> {
    const result = await this.messageModel.updateMany(
      {
        conversation: new Types.ObjectId(conversationId),
        receiver: new Types.ObjectId(userId),
        status: { $ne: MessageStatus.READ },
        isDeleted: false,
      },
      {
        $set: {
          status: MessageStatus.READ,
          readAt: new Date(),
        },
      },
    );

    return result.modifiedCount;
  }

  /**
   * Mark messages as delivered
   */
  async markAsDelivered(receiverId: string | Types.ObjectId): Promise<number> {
    const result = await this.messageModel.updateMany(
      {
        receiver: new Types.ObjectId(receiverId),
        status: MessageStatus.SENT,
        isDeleted: false,
      },
      {
        $set: {
          status: MessageStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      },
    );

    return result.modifiedCount;
  }

  /**
   * Get unread message count for a user in a conversation
   */
  async getUnreadCount(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<number> {
    return this.messageModel.countDocuments({
      conversation: new Types.ObjectId(conversationId),
      receiver: new Types.ObjectId(userId),
      status: { $ne: MessageStatus.READ },
      isDeleted: false,
    });
  }

  /**
   * Get IDs of unread messages for notification
   */
  async getUnreadMessageIds(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const messages = await this.messageModel
      .find({
        conversation: new Types.ObjectId(conversationId),
        receiver: new Types.ObjectId(userId),
        status: { $ne: MessageStatus.READ },
        isDeleted: false,
      })
      .select('_id')
      .exec();

    return messages.map((m) => m._id as Types.ObjectId);
  }

  /**
   * Soft delete a message
   */
  async softDelete(
    messageId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<MessageDocument | null> {
    return this.messageModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(messageId),
        sender: new Types.ObjectId(userId),
      },
      { $set: { isDeleted: true } },
      { returnDocument: 'after' },
    );
  }

  /**
   * Get message by ID with populated sender
   */
  async getMessageWithSender(messageId: string | Types.ObjectId): Promise<MessageDocument | null> {
    return this.messageModel
      .findById(messageId)
      .populate('sender', 'firstName lastName fullName profileImage')
      .exec();
  }
}
