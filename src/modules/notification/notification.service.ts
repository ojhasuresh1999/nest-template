import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationRepository } from './repositories/notification.repository';
import { FirebaseService } from '../../common/helpers/firebase/firebase.service';
import { UserRepository } from '../user/repositories/user.repository';
import { NotificationType } from './schemas/notification.schema';
import { PaginationResponse } from '../../common/types/api-response.type';
import { NotificationDocument } from './schemas/notification.schema';

export interface SendNotificationOptions {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, string>;
  metadata?: Record<string, any>;
  sendPush?: boolean;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly firebaseService: FirebaseService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Send a notification to a user (stores in DB and optionally sends push)
   */
  async sendNotification(options: SendNotificationOptions): Promise<NotificationDocument> {
    const { userId, title, body, type, data, metadata, sendPush = true } = options;

    // Create notification in database
    const notification = await this.notificationRepository.createNotification({
      userId,
      title,
      body,
      type,
      data,
      metadata,
    });

    // Send push notification if enabled
    if (sendPush) {
      await this.sendPushToUser(userId, title, body, data);
    }

    return notification;
  }

  /**
   * Send push notification to a user's devices
   */
  async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.firebaseService.isReady()) {
      this.logger.warn('Firebase not ready, skipping push notification');
      return;
    }

    try {
      const tokens = await this.userRepository.findDeviceTokens([userId]);

      if (tokens.length === 0) {
        this.logger.debug(`No active devices found for user ${userId}`);
        return;
      }

      const result = await this.firebaseService.sendPushNotification({
        tokens,
        title,
        body,
        data,
      });

      this.logger.log(
        `Push notification to user ${userId}: ${result.successCount} succeeded, ${result.failureCount} failed`,
      );

      // Handle failed tokens (could remove invalid tokens from DB)
      if (result.failedTokens.length > 0) {
        this.logger.debug(`Failed tokens: ${result.failedTokens.length}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${userId}`, error);
    }
  }

  /**
   * Get paginated notifications for a user
   */
  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 10,
    isRead?: boolean,
  ): Promise<PaginationResponse<NotificationDocument>> {
    return this.notificationRepository.findPaginated(userId, page, limit, isRead);
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationDocument> {
    const notification = await this.notificationRepository.markAsRead(notificationId, userId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    return this.notificationRepository.markAllAsRead(userId);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const deleted = await this.notificationRepository.deleteNotification(notificationId, userId);

    if (!deleted) {
      throw new NotFoundException('Notification not found');
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId: string): Promise<{ deletedCount: number }> {
    return this.notificationRepository.deleteAllForUser(userId);
  }

  /**
   * Legacy method for backward compatibility - sends push notification
   * @deprecated Use sendNotification() instead
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.sendNotification({
      userId,
      title,
      body,
      data,
      sendPush: true,
    });
  }
}
