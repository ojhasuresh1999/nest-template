import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Notification, NotificationDocument } from '../schemas/notification.schema';
import { buildPaginationMeta, PaginationResponse } from '../../../common/types/api-response.type';

export interface CreateNotificationData {
  userId: string | Types.ObjectId;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationRepository extends BaseRepository<NotificationDocument> {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {
    super(notificationModel);
  }

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData): Promise<NotificationDocument> {
    return this.notificationModel.create({
      ...data,
      userId: new Types.ObjectId(data.userId.toString()),
    });
  }

  /**
   * Get paginated notifications for a user
   */
  async findPaginated(
    userId: string,
    page: number = 1,
    limit: number = 10,
    isReadFilter?: boolean,
  ): Promise<PaginationResponse<NotificationDocument>> {
    const filter: any = { userId: new Types.ObjectId(userId) };

    if (isReadFilter !== undefined) {
      filter.isRead = isReadFilter;
    }

    const skip = (page - 1) * limit;

    const [docs, totalDocs] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      meta: buildPaginationMeta(totalDocs, page, limit),
      docs: docs as NotificationDocument[],
    };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationDocument | null> {
    return this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { isRead: true, readAt: new Date() },
      { returnDocument: 'after' },
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.notificationModel.deleteOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount === 1;
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllForUser(userId: string): Promise<{ deletedCount: number }> {
    const result = await this.notificationModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
    return { deletedCount: result.deletedCount };
  }
}
