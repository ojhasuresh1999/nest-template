import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ApiError } from '../../common/errors/api-error';
import { RedisService } from '../redis/redis.service';
import { UserRepository } from '../user/repositories/user.repository';
import { ConversationRepository, MessageRepository } from './repositories';
import { ConversationDocument } from './schemas/conversation.schema';
import { MessageDocument } from './schemas/message.schema';
import {
  ChatRedisKeys,
  MessageResponse,
  ONLINE_STATUS_TTL,
  TYPING_TTL,
} from './types/socket.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get or create a conversation between two users
   */
  async getOrCreateConversation(userId1: string, userId2: string): Promise<ConversationDocument> {
    // Validate that the other user exists
    const otherUser = await this.userRepository.findById(userId2);
    if (!otherUser || otherUser.isDeleted) {
      throw ApiError.notFound('User not found');
    }

    return this.conversationRepository.findOrCreateConversation(userId1, userId2);
  }

  /**
   * Get all conversations for a user, sorted by latest message
   */
  async getUserConversations(userId: string, page: number = 1, limit: number = 20) {
    const { conversations, total } = await this.conversationRepository.findUserConversations(
      userId,
      page,
      limit,
    );

    const onlineStatuses = await this.getMultipleOnlineStatus(
      conversations.flatMap((c) =>
        c.participants.map((p) => (p as any)._id?.toString() || p.toString()),
      ),
    );

    const transformedConversations = conversations.map((conv) => {
      const otherParticipant = conv.participants.find((p) => (p as any)._id?.toString() !== userId);
      const otherUserId =
        (otherParticipant as any)?._id?.toString() || otherParticipant?.toString();

      return {
        ...conv.toObject(),
        unreadCount: conv.unreadCount?.[userId] || 0,
        otherParticipant,
        isOnline: onlineStatuses[otherUserId] || false,
      };
    });

    const totalUnread = await this.conversationRepository.getTotalUnreadCount(userId);

    return {
      conversations: transformedConversations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
      totalUnread,
    };
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<ConversationDocument> {
    const isParticipant = await this.conversationRepository.isParticipant(conversationId, userId);

    if (!isParticipant) {
      throw ApiError.forbidden('Not a participant of this conversation');
    }

    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation || conversation.isDeleted) {
      throw ApiError.notFound('Conversation not found');
    }

    await conversation.populate('participants', 'firstName lastName fullName profileImage email');
    await conversation.populate('lastMessageSender', 'firstName lastName fullName');

    return conversation;
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    conversationId?: string,
    messageType: string = 'text',
    metadata?: Record<string, unknown>,
    _tempId?: string,
  ): Promise<{ message: MessageDocument; conversation: ConversationDocument }> {
    console.log('🚀 ~ ChatService ~ sendMessage ~ _tempId:', _tempId);
    const receiver = await this.userRepository.findById(receiverId);
    if (!receiver || receiver.isDeleted) {
      throw ApiError.notFound('Receiver not found');
    }

    let conversation: ConversationDocument;
    if (conversationId) {
      const isParticipant = await this.conversationRepository.isParticipant(
        conversationId,
        senderId,
      );
      if (!isParticipant) {
        throw ApiError.forbidden('Not a participant of this conversation');
      }
      conversation = (await this.conversationRepository.findById(conversationId))!;
    } else {
      conversation = await this.conversationRepository.findOrCreateConversation(
        senderId,
        receiverId,
      );
    }

    const message = await this.messageRepository.createMessage({
      conversation: conversation._id as Types.ObjectId,
      sender: senderId,
      receiver: receiverId,
      content,
      messageType,
      metadata,
    });

    await this.conversationRepository.updateLastMessage(
      conversation._id as Types.ObjectId,
      content,
      senderId,
      receiverId,
    );

    await message.populate('sender', 'firstName lastName fullName profileImage');

    this.logger.debug(
      `Message sent: ${senderId} -> ${receiverId} in conversation ${conversation._id}`,
    );

    return {
      message,
      conversation,
    };
  }

  /**
   * Get paginated messages for a conversation
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const isParticipant = await this.conversationRepository.isParticipant(conversationId, userId);

    if (!isParticipant) {
      throw ApiError.forbidden('Not a participant of this conversation');
    }

    return this.messageRepository.getConversationMessages(conversationId, page, limit);
  }

  /**
   * Mark all messages in a conversation as read for a user
   */
  async markMessagesAsRead(
    conversationId: string,
    userId: string,
  ): Promise<{ count: number; messageIds: string[] }> {
    const isParticipant = await this.conversationRepository.isParticipant(conversationId, userId);

    if (!isParticipant) {
      throw ApiError.forbidden('Not a participant of this conversation');
    }

    const unreadMessageIds = await this.messageRepository.getUnreadMessageIds(
      conversationId,
      userId,
    );

    const count = await this.messageRepository.markAsRead(conversationId, userId);
    await this.conversationRepository.resetUnreadCount(conversationId, userId);

    return {
      count,
      messageIds: unreadMessageIds.map((id) => id.toString()),
    };
  }

  /**
   * Mark all messages for a user as delivered (when user comes online)
   */
  async markMessagesAsDelivered(userId: string): Promise<number> {
    return this.messageRepository.markAsDelivered(userId);
  }

  /**
   * Set user as online
   */
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    await Promise.all([
      this.redisService.set(
        ChatRedisKeys.userOnline(userId),
        { online: true, lastSeen: new Date() },
        ONLINE_STATUS_TTL,
      ),
      this.redisService.set(ChatRedisKeys.userSocket(userId), socketId, ONLINE_STATUS_TTL),
    ]);
    this.logger.debug(`User ${userId} is now online with socket ${socketId}`);
  }

  /**
   * Set user as offline
   */
  async setUserOffline(userId: string): Promise<void> {
    await Promise.all([
      this.redisService.delete(ChatRedisKeys.userOnline(userId)),
      this.redisService.delete(ChatRedisKeys.userSocket(userId)),
    ]);
    this.logger.debug(`User ${userId} is now offline`);
  }

  /**
   * Check if a user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const status = await this.redisService.get<{ online: boolean }>(
      ChatRedisKeys.userOnline(userId),
    );
    return status?.online || false;
  }

  /**
   * Get online status for multiple users
   */
  async getMultipleOnlineStatus(userIds: string[]): Promise<Record<string, boolean>> {
    const uniqueIds = [...new Set(userIds)];
    const statuses: Record<string, boolean> = {};

    await Promise.all(
      uniqueIds.map(async (userId) => {
        statuses[userId] = await this.isUserOnline(userId);
      }),
    );

    return statuses;
  }

  /**
   * Get user's socket ID
   */
  async getUserSocketId(userId: string): Promise<string | null> {
    return this.redisService.get<string>(ChatRedisKeys.userSocket(userId));
  }

  /**
   * Set typing status
   */
  async setTypingStatus(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    const key = ChatRedisKeys.userTyping(conversationId, userId);

    if (isTyping) {
      await this.redisService.set(key, true, TYPING_TTL);
    } else {
      await this.redisService.delete(key);
    }
  }

  /**
   * Get the other participant in a conversation
   */
  async getOtherParticipant(conversationId: string, userId: string): Promise<string | null> {
    const other = await this.conversationRepository.getOtherParticipant(conversationId, userId);
    return other?.toString() || null;
  }

  /**
   * Transform message document to response format
   */
  transformMessageToResponse(message: MessageDocument, tempId?: string): MessageResponse {
    const sender = message.sender as any;
    return {
      _id: (message._id as Types.ObjectId).toString(),
      conversationId: message.conversation.toString(),
      sender: {
        _id: sender._id?.toString() || sender.toString(),
        firstName: sender.firstName || '',
        lastName: sender.lastName || '',
        fullName: sender.fullName || '',
        profileImage: sender.profileImage,
      },
      receiver: message.receiver.toString(),
      content: message.content,
      messageType: message.messageType,
      status: message.status,
      createdAt: (message as any).createdAt,
      tempId,
    };
  }

  /**
   * Validate that user is participant of conversation
   */
  async validateParticipant(conversationId: string, userId: string): Promise<boolean> {
    return this.conversationRepository.isParticipant(conversationId, userId);
  }
}
