import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';

@Injectable()
export class ConversationRepository extends BaseRepository<ConversationDocument> {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
  ) {
    super(conversationModel);
  }

  /**
   * Find or create a conversation between two users
   */
  async findOrCreateConversation(
    userId1: string | Types.ObjectId,
    userId2: string | Types.ObjectId,
  ): Promise<ConversationDocument> {
    const id1 = new Types.ObjectId(userId1);
    const id2 = new Types.ObjectId(userId2);

    let conversation = await this.conversationModel.findOne({
      participants: { $all: [id1, id2] },
      isDeleted: false,
    });

    if (!conversation) {
      conversation = await this.conversationModel.create({
        participants: [id1, id2],
        unreadCount: {
          [id1.toString()]: 0,
          [id2.toString()]: 0,
        },
        lastMessageAt: new Date(),
      });
    }

    return conversation;
  }

  /**
   * Get all conversations for a user, sorted by latest message
   */
  async findUserConversations(
    userId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ conversations: ConversationDocument[]; total: number }> {
    const id = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.conversationModel
        .find({
          participants: id,
          isDeleted: false,
        })
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants', 'firstName lastName fullName profileImage email')
        .populate('lastMessageSender', 'firstName lastName fullName')
        .exec(),
      this.conversationModel.countDocuments({
        participants: id,
        isDeleted: false,
      }),
    ]);

    return { conversations, total };
  }

  /**
   * Update conversation with new message details
   */
  async updateLastMessage(
    conversationId: string | Types.ObjectId,
    message: string,
    senderId: string | Types.ObjectId,
    receiverId: string | Types.ObjectId,
  ): Promise<ConversationDocument | null> {
    return this.conversationModel.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          lastMessage: message.length > 100 ? message.substring(0, 100) + '...' : message,
          lastMessageSender: new Types.ObjectId(senderId),
          lastMessageAt: new Date(),
        },
        $inc: {
          [`unreadCount.${receiverId.toString()}`]: 1,
        },
      },
      { returnDocument: 'after' },
    );
  }

  /**
   * Reset unread count for a user in a conversation
   */
  async resetUnreadCount(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<ConversationDocument | null> {
    return this.conversationModel.findByIdAndUpdate(
      conversationId,
      {
        $set: {
          [`unreadCount.${userId.toString()}`]: 0,
        },
      },
      { returnDocument: 'after' },
    );
  }

  /**
   * Check if user is a participant in the conversation
   */
  async isParticipant(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      participants: new Types.ObjectId(userId),
      isDeleted: false,
    });
    return !!conversation;
  }

  /**
   * Get the other participant in a conversation
   */
  async getOtherParticipant(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<Types.ObjectId | null> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) return null;

    const userObjId = new Types.ObjectId(userId);
    const other = conversation.participants.find((p) => !p.equals(userObjId));
    return other || null;
  }

  /**
   * Get total unread count across all conversations for a user
   */
  async getTotalUnreadCount(userId: string | Types.ObjectId): Promise<number> {
    const result = await this.conversationModel.aggregate([
      {
        $match: {
          participants: new Types.ObjectId(userId),
          isDeleted: false,
        },
      },
      {
        $project: {
          unread: { $ifNull: [`$unreadCount.${userId.toString()}`, 0] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$unread' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }
}
