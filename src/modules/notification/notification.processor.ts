import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FirebaseService } from '../../common/helpers/firebase/firebase.service';
import { UserRepository } from '../user/repositories/user.repository';

export interface PushNotificationJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly userRepository: UserRepository,
  ) {
    super();
  }

  async process(job: Job<PushNotificationJobData, any, string>): Promise<any> {
    switch (job.name) {
      case 'send-push':
        return this.handleSendPush(job);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }

  private async handleSendPush(job: Job<PushNotificationJobData>): Promise<void> {
    const { userId, title, body, data } = job.data;
    this.logger.log(`Processing push notification for user ${userId}`);

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
        `Push notification completed: ${result.successCount} succeeded, ${result.failureCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`, error.stack);
      throw error; // Trigger BullMQ retry
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
