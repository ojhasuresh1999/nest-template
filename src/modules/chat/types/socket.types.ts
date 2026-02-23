import { Socket } from 'socket.io';

/**
 * Authenticated socket interface with user data
 */
export interface AuthenticatedSocket extends Socket {
  user: {
    userId: string;
    email: string;
    role?: unknown;
    brand?: string;
    deviceId: string;
  };
}

/**
 * Socket.IO event payloads
 */
export interface SendMessagePayload {
  conversationId?: string;
  receiverId: string;
  content: string;
  messageType?: 'text' | 'image' | 'file';
  metadata?: Record<string, unknown>;
  tempId?: string;
}

export interface TypingPayload {
  conversationId: string;
}

export interface MarkReadPayload {
  conversationId: string;
}

export interface JoinConversationPayload {
  conversationId: string;
}

/**
 * Socket.IO event responses
 */
export interface MessageResponse {
  _id: string;
  conversationId: string;
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    profileImage?: string;
  };
  receiver: string;
  content: string;
  messageType: string;
  status: string;
  createdAt: Date;
  tempId?: string;
}

export interface TypingResponse {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface MessagesReadResponse {
  conversationId: string;
  readBy: string;
  readAt: Date;
  messageIds: string[];
}

export interface UserStatusResponse {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface ConversationUpdateResponse {
  conversationId: string;
  lastMessage: string;
  lastMessageSender: string;
  lastMessageAt: Date;
  unreadCount: number;
}

/**
 * Redis keys for chat functionality
 */
export const ChatRedisKeys = {
  userSocket: (userId: string) => `chat:user:${userId}:socket`,
  userOnline: (userId: string) => `chat:user:${userId}:online`,
  userTyping: (conversationId: string, userId: string) => `chat:typing:${conversationId}:${userId}`,
  conversationRoom: (conversationId: string) => `conversation:${conversationId}`,
  onlineUsers: 'chat:online_users',
} as const;

/**
 * Socket.IO event names
 */
export const ChatEvents = {
  // Client to Server
  SEND_MESSAGE: 'send_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  MARK_READ: 'mark_read',
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',
  GET_ONLINE_STATUS: 'get_online_status',

  // Server to Client
  RECEIVE_MESSAGE: 'receive_message',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_ERROR: 'message_error',
  USER_TYPING: 'user_typing',
  MESSAGES_READ: 'messages_read',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  CONVERSATION_UPDATED: 'conversation_updated',
  UNREAD_COUNT: 'unread_count',
} as const;

/**
 * Typing indicator TTL in seconds
 */
export const TYPING_TTL = 3;

/**
 * Online status TTL in seconds (used for heartbeat)
 */
export const ONLINE_STATUS_TTL = 60;
