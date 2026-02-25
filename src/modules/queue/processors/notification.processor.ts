import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Queues } from '../queue.constants';
import { SendPushDto, SendInAppDto } from '../dto';
import type { JobResult } from '../queue.types';

/**
 * Notification Queue Processor
 * Handles push notifications and in-app notifications
 *
 * TODO: Integrate with actual push notification providers (Firebase, OneSignal, etc.)
 */
@Processor(Queues.QUEUE__NOTIFICATION.name, {
  concurrency: 10,
  limiter: {
    max: 50,
    duration: 1000, // Max 50 notifications per second
  },
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly jobs = Queues.QUEUE__NOTIFICATION.jobs;
  /**
   * TODO : Inject notification providers
   */
  // constructor(
  //   private readonly pushProvider: PushNotificationService,
  //   private readonly inAppProvider: InAppNotificationService,
  // ) {
  //   super();
  // }

  /**
   * Main job processing method
   */
  async process(job: Job): Promise<JobResult> {
    this.logger.log(`Processing notification job [${job.id}] - ${job.name}`);

    try {
      await job.updateProgress(10);

      let result: JobResult;

      switch (job.name) {
        case this.jobs.SEND_PUSH.name:
          result = await this.handleSendPush(job.data as SendPushDto);
          break;

        case this.jobs.SEND_IN_APP.name:
          result = await this.handleSendInApp(job.data as SendInAppDto);
          break;

        default:
          throw new Error(`Unknown notification job type: ${job.name}`);
      }

      await job.updateProgress(100);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Notification Job [${job.id}] failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}): ${errorMessage}`,
        errorStack,
      );

      throw error;
    }
  }

  // ============================================================================
  // Job Handlers
  // ============================================================================

  /**
   * Handle push notification
   */
  private async handleSendPush(data: SendPushDto): Promise<JobResult> {
    /**
     * TODO : Replace with actual push notification provider
     */
    this.logger.log(`[MOCK PUSH] User: ${data.userId}, Title: ${data.title}, Body: ${data.body}`);

    await this.simulateApiCall();

    // Example Firebase implementation:
    // await this.pushProvider.send({
    //   userId: data.userId,
    //   notification: {
    //     title: data.title,
    //     body: data.body,
    //   },
    //   data: data.data,
    // });

    return {
      success: true,
      message: `Push notification sent to user ${data.userId}`,
      timestamp: new Date(),
      data: {
        userId: data.userId,
        title: data.title,
      },
    };
  }

  /**
   * Handle in-app notification
   */
  private async handleSendInApp(data: SendInAppDto): Promise<JobResult> {
    /**
     * TODO : Store in-app notification in database
     */
    this.logger.log(
      `[MOCK IN-APP] User: ${data.userId}, Type: ${data.type}, Message: ${data.message}`,
    );

    await this.simulateApiCall();

    // Example implementation:
    // await this.inAppProvider.create({
    //   userId: data.userId,
    //   type: data.type,
    //   message: data.message,
    //   metadata: data.metadata,
    //   read: false,
    //   createdAt: new Date(),
    // });

    return {
      success: true,
      message: `In-app notification created for user ${data.userId}`,
      timestamp: new Date(),
      data: {
        userId: data.userId,
        type: data.type,
      },
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Simulate API call delay for mock implementation
   */
  private async simulateApiCall(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
  }

  // ============================================================================
  // Worker Events
  // ============================================================================

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: JobResult) {
    this.logger.log(`✅ Notification Job [${job.id}] completed: ${result.message}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts || 3;
    const isFinalAttempt = job.attemptsMade >= maxAttempts;

    if (isFinalAttempt) {
      this.logger.error(
        `🚨 [DLQ] Notification Job [${job.id}] permanently failed | name=${job.name} | attempts=${job.attemptsMade} | error=${error.message} | data=${JSON.stringify(job.data)}`,
      );
    } else {
      this.logger.warn(
        `❌ Notification Job [${job.id}] failed (attempt ${job.attemptsMade}/${maxAttempts}): ${error.message}`,
      );
    }
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number | object) {
    const progressValue = typeof progress === 'number' ? progress : JSON.stringify(progress);
    this.logger.debug(`📊 Notification Job [${job.id}] progress: ${progressValue}%`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`🚀 Notification Job [${job.id}] started processing`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`⚠️ Notification Job [${jobId}] stalled`);
  }
}
