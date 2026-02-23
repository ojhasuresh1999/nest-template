import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AllConfigType } from '../../config/config.types';
import { ChatService } from './chat.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import {
  AuthenticatedSocket,
  ChatEvents,
  ChatRedisKeys,
  JoinConversationPayload,
  MarkReadPayload,
  SendMessagePayload,
  TypingPayload,
} from './types/socket.types';

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  afterInit() {
    this.logger.log('🚀 Chat WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateSocket(client);

      if (!user) {
        this.logger.warn(`Unauthenticated connection attempt: ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const userRoom = `user:${user.userId}`;
      client.join(userRoom);

      await this.chatService.setUserOnline(user.userId, client.id);

      const deliveredCount = await this.chatService.markMessagesAsDelivered(user.userId);
      if (deliveredCount > 0) {
        this.logger.debug(`Marked ${deliveredCount} messages as delivered for user ${user.userId}`);
      }

      this.broadcastUserStatus(user.userId, true);

      this.logger.log(`User ${user.userId} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = (client as AuthenticatedSocket).user;

    if (user?.userId) {
      await this.chatService.setUserOffline(user.userId);
      this.broadcastUserStatus(user.userId, false);
      this.logger.log(`User ${user.userId} disconnected`);
    }
  }

  @SubscribeMessage(ChatEvents.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    try {
      const senderId = client.user.userId;

      if (!payload.receiverId || !payload.content?.trim()) {
        throw new WsException('Invalid message payload');
      }
      if (payload.receiverId === senderId) {
        throw new WsException('Cannot send message to yourself');
      }

      const { message, conversation } = await this.chatService.sendMessage(
        senderId,
        payload.receiverId,
        payload.content.trim(),
        payload.conversationId,
        payload.messageType || 'text',
        payload.metadata,
        payload.tempId,
      );

      const messageResponse = this.chatService.transformMessageToResponse(message, payload.tempId);

      client.emit(ChatEvents.RECEIVE_MESSAGE, messageResponse);

      const receiverRoom = `user:${payload.receiverId}`;
      this.server.to(receiverRoom).emit(ChatEvents.RECEIVE_MESSAGE, messageResponse);
      const conversationUpdate = {
        conversationId: conversation._id.toString(),
        lastMessage:
          message.content.length > 100
            ? message.content.substring(0, 100) + '...'
            : message.content,
        lastMessageSender: senderId,
        lastMessageAt: new Date(),
      };

      client.emit(ChatEvents.CONVERSATION_UPDATED, {
        ...conversationUpdate,
        unreadCount: 0,
      });

      this.server.to(receiverRoom).emit(ChatEvents.CONVERSATION_UPDATED, {
        ...conversationUpdate,
        unreadCount: (conversation.unreadCount?.[payload.receiverId] || 0) + 1,
      });

      this.logger.debug(`Message sent: ${senderId} -> ${payload.receiverId}`);
    } catch (error) {
      this.logger.error(`Send message error: ${error.message}`);
      client.emit(ChatEvents.MESSAGE_ERROR, {
        error: error.message,
        tempId: payload.tempId,
      });
    }
  }

  @SubscribeMessage(ChatEvents.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload,
  ) {
    try {
      const userId = client.user.userId;

      await this.chatService.setTypingStatus(payload.conversationId, userId, true);

      const receiverId = await this.chatService.getOtherParticipant(payload.conversationId, userId);

      if (receiverId) {
        const receiverRoom = `user:${receiverId}`;
        this.server.to(receiverRoom).emit(ChatEvents.USER_TYPING, {
          conversationId: payload.conversationId,
          userId,
          isTyping: true,
        });
      }
    } catch (error) {
      this.logger.error(`Typing start error: ${error.message}`);
    }
  }

  @SubscribeMessage(ChatEvents.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload,
  ) {
    try {
      const userId = client.user.userId;

      await this.chatService.setTypingStatus(payload.conversationId, userId, false);

      const receiverId = await this.chatService.getOtherParticipant(payload.conversationId, userId);

      if (receiverId) {
        const receiverRoom = `user:${receiverId}`;
        this.server.to(receiverRoom).emit(ChatEvents.USER_TYPING, {
          conversationId: payload.conversationId,
          userId,
          isTyping: false,
        });
      }
    } catch (error) {
      this.logger.error(`Typing stop error: ${error.message}`);
    }
  }

  @SubscribeMessage(ChatEvents.MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadPayload,
  ) {
    try {
      const userId = client.user.userId;

      const { count, messageIds } = await this.chatService.markMessagesAsRead(
        payload.conversationId,
        userId,
      );

      if (count > 0) {
        const senderId = await this.chatService.getOtherParticipant(payload.conversationId, userId);

        if (senderId) {
          const senderRoom = `user:${senderId}`;
          this.server.to(senderRoom).emit(ChatEvents.MESSAGES_READ, {
            conversationId: payload.conversationId,
            readBy: userId,
            readAt: new Date(),
            messageIds,
          });
        }

        client.emit(ChatEvents.UNREAD_COUNT, {
          conversationId: payload.conversationId,
          unreadCount: 0,
        });
      }
    } catch (error) {
      this.logger.error(`Mark read error: ${error.message}`);
    }
  }

  @SubscribeMessage(ChatEvents.JOIN_CONVERSATION)
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    try {
      const userId = client.user.userId;

      const isParticipant = await this.chatService.validateParticipant(
        payload.conversationId,
        userId,
      );

      if (!isParticipant) {
        throw new WsException('Not a participant of this conversation');
      }

      const conversationRoom = ChatRedisKeys.conversationRoom(payload.conversationId);
      client.join(conversationRoom);

      this.logger.debug(`User ${userId} joined conversation ${payload.conversationId}`);
    } catch (error) {
      this.logger.error(`Join conversation error: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage(ChatEvents.LEAVE_CONVERSATION)
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    const conversationRoom = ChatRedisKeys.conversationRoom(payload.conversationId);
    client.leave(conversationRoom);
    this.logger.debug(`User ${client.user.userId} left conversation ${payload.conversationId}`);
  }

  @SubscribeMessage(ChatEvents.GET_ONLINE_STATUS)
  async handleGetOnlineStatus(
    @ConnectedSocket() _client: AuthenticatedSocket,
    @MessageBody() payload: { userIds: string[] },
  ) {
    try {
      const statuses = await this.chatService.getMultipleOnlineStatus(payload.userIds);

      return Object.entries(statuses).map(([userId, isOnline]) => ({
        userId,
        isOnline,
      }));
    } catch (error) {
      this.logger.error(`Get online status error: ${error.message}`);
      return [];
    }
  }

  private async authenticateSocket(client: Socket): Promise<AuthenticatedSocket['user'] | null> {
    try {
      if ((client as AuthenticatedSocket).user) {
        return (client as AuthenticatedSocket).user;
      }

      const token = this.extractToken(client);
      if (!token) {
        return null;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow('auth.jwtSecret', { infer: true }),
      });

      return {
        userId: payload.sub,
        email: payload.email,
        deviceId: payload.deviceId,
        role: payload.role,
        brand: payload.brand,
      };
    } catch (error) {
      this.logger.error(`Socket authentication failed: ${error.message}`);
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken;
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private broadcastUserStatus(userId: string, isOnline: boolean) {
    this.server.emit(isOnline ? ChatEvents.USER_ONLINE : ChatEvents.USER_OFFLINE, {
      userId,
      isOnline,
      lastSeen: isOnline ? undefined : new Date(),
    });
  }

  /**
   * Send message to a specific user (called from REST API)
   */
  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    const userRoom = `user:${userId}`;
    this.server.to(userRoom).emit(event, data);
  }

  /**
   * Send message to a conversation room
   */
  async sendToConversation(conversationId: string, event: string, data: any): Promise<void> {
    const room = ChatRedisKeys.conversationRoom(conversationId);
    this.server.to(room).emit(event, data);
  }
}
