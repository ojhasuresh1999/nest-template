import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Queues } from '../queue.constants';
import { MailHelper } from 'src/common/helpers/mail/mail.helper';
import { SendWelcomeEmailDto, SendPromotionalEmailDto } from '../dto';
import type { JobResult } from '../queue.types';

/**
 * Low-Priority Email Queue Processor
 * Handles non-critical email-related background jobs
 */
@Processor(Queues.QUEUE__LOW_PRIORITY_EMAIL.name, {
  concurrency: 2,
  limiter: {
    max: 20,
    duration: 1000,
  },
})
export class LowPriorityEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(LowPriorityEmailProcessor.name);
  private readonly jobs = Queues.QUEUE__LOW_PRIORITY_EMAIL.jobs;

  constructor(private readonly mailHelper: MailHelper) {
    super();
  }

  async process(job: Job): Promise<JobResult> {
    this.logger.log(`Processing job [${job.id}] - ${job.name}`);

    try {
      await job.updateProgress(10);
      let result: JobResult;

      switch (job.name) {
        case this.jobs.SEND_WELCOME_EMAIL.name:
          result = await this.handleSendWelcomeEmail(job.data as SendWelcomeEmailDto);
          break;

        case this.jobs.SEND_PROMOTIONAL_EMAIL.name:
          result = await this.handleSendPromotionalEmail(job.data as SendPromotionalEmailDto);
          break;

        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      await job.updateProgress(100);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Job [${job.id}] failed (attempt ${job.attemptsMade}/${job.opts.attempts || 2}): ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  // ============================================================================
  // Job Handlers
  // ============================================================================

  private async handleSendWelcomeEmail(data: SendWelcomeEmailDto): Promise<JobResult> {
    await this.mailHelper.sendMail(data.to, 'Welcome to Consultly!', 'welcome', {
      userName: data.userName,
      verificationLink: data.verificationLink,
    });

    return {
      success: true,
      message: `Welcome email sent to ${data.to}`,
      timestamp: new Date(),
    };
  }

  private async handleSendPromotionalEmail(data: SendPromotionalEmailDto): Promise<JobResult> {
    await this.mailHelper.sendMail(data.to, data.campaignContent, 'promotional', {
      userName: data.userName,
      campaignContent: data.campaignContent,
    });

    return {
      success: true,
      message: `Promotional email sent to ${data.to}`,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // Worker Events
  // ============================================================================

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: JobResult) {
    this.logger.log(`✅ Job [${job.id}] completed: ${result.message}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts || 2;
    const isFinalAttempt = job.attemptsMade >= maxAttempts;

    if (isFinalAttempt) {
      this.logger.error(
        `🚨 [DLQ] Low-Priority Email Job [${job.id}] permanently failed | name=${job.name} | error=${error.message}`,
      );
    } else {
      this.logger.warn(
        `❌ Low-Priority Email Job [${job.id}] failed (attempt ${job.attemptsMade}/${maxAttempts}): ${error.message}`,
      );
    }
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number | object) {
    const progressValue = typeof progress === 'number' ? progress : JSON.stringify(progress);
    this.logger.debug(`📊 Job [${job.id}] progress: ${progressValue}%`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`🚀 Job [${job.id}] started processing`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`⚠️ Job [${jobId}] stalled`);
  }
}
