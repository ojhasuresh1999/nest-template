import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponse } from 'src/common/decorators/api-standard-response.decorator';
import {
  MultiSharpS3Interceptor,
  UploadedFilesMap,
} from 'src/common/interceptors/sharpS3File.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import {
  ConversationsListResponseDto,
  GetMessagesQueryDto,
  MarkReadResponseDto,
  MessageResponseDto,
  MessagesListResponseDto,
  MessageSentResponseDto,
  PaginationQueryDto,
  SendMessageDto,
  UploadChatFileDto,
  UploadChatFileResponseDto,
} from './dto';
import { ChatEvents } from './types/socket.types';
import { MessageType } from './schemas/message.schema';
import { Request } from 'express';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'Get all conversations',
    description:
      'Returns paginated list of conversations sorted by latest message. Also returns total unread count.',
  })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Conversations retrieved successfully',
    type: ConversationsListResponseDto,
  })
  async getConversations(
    @CurrentUser('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.chatService.getUserConversations(userId, query.page || 1, query.limit || 20);
  }

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'Get a single conversation',
    description: 'Returns conversation details with participants',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Conversation retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Conversation not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not a participant of this conversation',
  })
  async getConversation(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ) {
    const conversation = await this.chatService.getConversation(conversationId, userId);
    return {
      ...conversation.toObject(),
      unreadCount: conversation.unreadCount?.[userId] || 0,
    };
  }

  @Post('conversations/user/:userId')
  @ApiOperation({
    summary: 'Create or get conversation with user',
    description: 'Creates a new conversation with the specified user or returns existing one',
  })
  @ApiParam({ name: 'userId', description: 'User ID to start conversation with' })
  @ApiStandardResponse({
    status: HttpStatus.CREATED,
    description: 'Conversation created/retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found',
  })
  async createOrGetConversation(
    @CurrentUser('userId') currentUserId: string,
    @Param('userId') targetUserId: string,
  ) {
    const conversation = await this.chatService.getOrCreateConversation(
      currentUserId,
      targetUserId,
    );

    await conversation.populate('participants', 'firstName lastName fullName profileImage email');

    return {
      ...conversation.toObject(),
      unreadCount: conversation.unreadCount?.[currentUserId] || 0,
    };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'Get messages in conversation',
    description:
      'Returns paginated messages in a conversation, sorted by creation time (oldest first)',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully',
    type: MessagesListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not a participant of this conversation',
  })
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ): Promise<MessagesListResponseDto> {
    const result = await this.chatService.getConversationMessages(
      conversationId,
      userId,
      query.page || 1,
      query.limit || 50,
    );

    return {
      messages: result.messages as unknown as MessageResponseDto[],
      total: result.total,
      page: query.page || 1,
      limit: query.limit || 50,
      hasMore: result.hasMore,
    };
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Sends a message to a user. If conversationId is not provided, a new conversation will be created.',
  })
  @ApiStandardResponse({
    status: HttpStatus.CREATED,
    description: 'Message sent successfully',
    type: MessageSentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Receiver not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not a participant of this conversation',
  })
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageSentResponseDto> {
    const { message, conversation } = await this.chatService.sendMessage(
      userId,
      dto.receiverId,
      dto.content || '',
      dto.conversationId,
      dto.messageType,
      dto.metadata,
      dto.tempId,
    );

    const messageResponse = this.chatService.transformMessageToResponse(message, dto.tempId);

    // Also emit via WebSocket for real-time delivery
    await this.chatGateway.sendToUser(dto.receiverId, ChatEvents.RECEIVE_MESSAGE, messageResponse);

    // Emit conversation update
    const conversationUpdate = {
      conversationId: conversation._id.toString(),
      lastMessage:
        message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content,
      lastMessageSender: userId,
      lastMessageAt: new Date(),
    };

    await this.chatGateway.sendToUser(dto.receiverId, ChatEvents.CONVERSATION_UPDATED, {
      ...conversationUpdate,
      unreadCount: (conversation.unreadCount?.[dto.receiverId] || 0) + 1,
    });

    return {
      success: true,
      message: messageResponse as unknown as MessageResponseDto,
    };
  }

  @Patch('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark conversation as read',
    description: 'Marks all messages in a conversation as read for the current user',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Messages marked as read',
    type: MarkReadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not a participant of this conversation',
  })
  async markConversationAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ): Promise<MarkReadResponseDto> {
    const { count, messageIds } = await this.chatService.markMessagesAsRead(conversationId, userId);

    // Notify the sender that their messages were read
    const senderId = await this.chatService.getOtherParticipant(conversationId, userId);

    if (senderId && count > 0) {
      await this.chatGateway.sendToUser(senderId, ChatEvents.MESSAGES_READ, {
        conversationId,
        readBy: userId,
        readAt: new Date(),
        messageIds,
      });
    }

    return {
      success: true,
      count,
      conversationId,
    };
  }

  @Get('online-status/:userId')
  @ApiOperation({
    summary: 'Get user online status',
    description: 'Check if a specific user is currently online',
  })
  @ApiParam({ name: 'userId', description: 'User ID to check' })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Online status retrieved',
  })
  async getOnlineStatus(@Param('userId') userId: string) {
    const isOnline = await this.chatService.isUserOnline(userId);
    return { userId, isOnline };
  }

  @Post('online-status/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get online status for multiple users',
    description: 'Check online status for a list of users',
  })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Online statuses retrieved',
  })
  async getMultipleOnlineStatus(@Body() body: { userIds: string[] }) {
    const statuses = await this.chatService.getMultipleOnlineStatus(body.userIds);
    return Object.entries(statuses).map(([userId, isOnline]) => ({
      userId,
      isOnline,
    }));
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get total unread count',
    description: 'Returns total unread message count across all conversations',
  })
  @ApiStandardResponse({
    status: HttpStatus.OK,
    description: 'Unread count retrieved',
  })
  async getTotalUnreadCount(@CurrentUser('userId') userId: string) {
    const conversations = await this.chatService.getUserConversations(userId, 1, 1);
    return { totalUnread: conversations.totalUnread };
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    MultiSharpS3Interceptor([{ name: 'file', directory: 'chat/files', maxCount: 1 }]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload file/image in chat',
    description:
      'Upload an image or file to send in a chat conversation. Supports images (jpg, png) and videos.',
  })
  @ApiStandardResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded and message sent successfully',
    type: UploadChatFileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No file uploaded or invalid file type',
  })
  async uploadFile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UploadChatFileDto,
    @Req() req: Request,
  ): Promise<{ file: UploadChatFileResponseDto; message: MessageResponseDto }> {
    const uploadedFiles = (req as Request & { uploadedFiles?: UploadedFilesMap }).uploadedFiles;
    const fileUrl = uploadedFiles?.file?.[0];

    if (!fileUrl) {
      throw new Error('No file uploaded');
    }

    const isImage = /\.(jpg|jpeg|png|webp|avif)$/i.test(fileUrl);
    const messageType = isImage ? MessageType.IMAGE : MessageType.FILE;

    const fileName = fileUrl.split('/').pop() || 'file';
    const mimeType = isImage ? 'image/jpeg' : 'application/octet-stream';

    const metadata = {
      fileUrl,
      fileName,
      mimeType,
      caption: dto.caption,
    };

    const { message, conversation } = await this.chatService.sendMessage(
      userId,
      dto.receiverId,
      dto.caption || fileUrl,
      dto.conversationId,
      messageType,
      metadata,
      dto.tempId,
    );

    const messageResponse = this.chatService.transformMessageToResponse(message, dto.tempId);

    await this.chatGateway.sendToUser(dto.receiverId, ChatEvents.RECEIVE_MESSAGE, messageResponse);

    const conversationUpdate = {
      conversationId: conversation._id.toString(),
      lastMessage: isImage ? '📷 Image' : '📎 File',
      lastMessageSender: userId,
      lastMessageAt: new Date(),
    };

    await this.chatGateway.sendToUser(dto.receiverId, ChatEvents.CONVERSATION_UPDATED, {
      ...conversationUpdate,
      unreadCount: (conversation.unreadCount?.[dto.receiverId] || 0) + 1,
    });

    return {
      file: {
        fileUrl,
        fileName,
        fileSize: 0,
        mimeType,
        messageType: isImage ? 'image' : 'file',
      },
      message: messageResponse as unknown as MessageResponseDto,
    };
  }
}
