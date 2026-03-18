import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Queues } from '../queue.constants';
import { MailHelper } from 'src/common/helpers/mail/mail.helper';
import {
  SendEmailDto,
  SendBulkEmailDto,
  SendPasswordResetDto,
  SendEmailVerificationDto,
  SendOtpEmailDto,
} from '../dto';
import type { JobResult } from '../queue.types';

/**
 * Email Queue Processor
 * Handles all email-related background jobs
 */
@Processor(Queues.QUEUE__EMAIL.name, {
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly jobs = Queues.QUEUE__EMAIL.jobs;

  constructor(private readonly mailHelper: MailHelper) {
    super();
  }

  /**
   * Main job processing method
   * Routes to specific handlers based on job name
   */
  async process(job: Job): Promise<JobResult> {
    this.logger.log(`Processing job [${job.id}] - ${job.name}`);

    try {
      await job.updateProgress(10);

      let result: JobResult;

      switch (job.name) {
        case this.jobs.SEND_EMAIL.name:
          result = await this.handleSendEmail(job.data as SendEmailDto);
          break;

        case this.jobs.SEND_BULK_EMAIL.name:
          result = await this.handleSendBulkEmail(job.data as SendBulkEmailDto, job);
          break;

        case this.jobs.SEND_PASSWORD_RESET.name:
          result = await this.handleSendPasswordReset(job.data as SendPasswordResetDto);
          break;

        case this.jobs.SEND_EMAIL_VERIFICATION.name:
          result = await this.handleSendEmailVerification(job.data as SendEmailVerificationDto);
          break;

        case this.jobs.SEND_OTP_EMAIL.name:
          result = await this.handleSendOtpEmail(job.data as SendOtpEmailDto);
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
        `Job [${job.id}] failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}): ${errorMessage}`,
        errorStack,
      );

      // Re-throw to trigger retry
      throw error;
    }
  }

  // ============================================================================
  // Job Handlers
  // ============================================================================

  /**
   * Handle generic email sending
   */
  private async handleSendEmail(data: SendEmailDto): Promise<JobResult> {
    await this.mailHelper.sendMail(data.to, data.subject, data.templateName, data.locals);

    const recipients = Array.isArray(data.to) ? data.to.join(', ') : data.to;
    return {
      success: true,
      message: `Email sent to ${recipients}`,
      timestamp: new Date(),
    };
  }

  /**
   * Handle bulk email sending with progress tracking
   */
  private async handleSendBulkEmail(data: SendBulkEmailDto, job: Job): Promise<JobResult> {
    const total = data.recipients.length;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < total; i++) {
      const recipient = data.recipients[i];

      try {
        await this.mailHelper.sendMail(
          recipient.to,
          recipient.subject,
          recipient.templateName,
          recipient.locals,
        );
        succeeded++;
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${recipient.to}: ${errorMsg}`);
        this.logger.warn(`Bulk email failed for ${recipient.to}: ${errorMsg}`);
      }

      // Update progress (10% to 90% for actual processing)
      const progress = 10 + Math.floor((i / total) * 80);
      await job.updateProgress(progress);
    }

    return {
      success: failed === 0,
      message: `Bulk email: ${succeeded}/${total} succeeded, ${failed} failed`,
      timestamp: new Date(),
      data: {
        total,
        succeeded,
        failed,
        errors: errors.slice(0, 10), // Limit error messages
      },
    };
  }

  /**
   * Handle password reset email
   */
  private async handleSendPasswordReset(data: SendPasswordResetDto): Promise<JobResult> {
    await this.mailHelper.sendMail(
      data.to,
      'Password Reset Request - Consultly',
      'password-reset',
      {
        userName: data.userName,
        resetLink: data.resetLink,
        expiresIn: data.expiresIn,
      },
    );

    return {
      success: true,
      message: `Password reset email sent to ${data.to}`,
      timestamp: new Date(),
    };
  }

  /**
   * Handle email verification
   */
  private async handleSendEmailVerification(data: SendEmailVerificationDto): Promise<JobResult> {
    await this.mailHelper.sendMail(data.to, 'Verify Your Email - Consultly', 'email-verification', {
      userName: data.userName,
      verificationLink: data.verificationLink,
      expiresIn: data.expiresIn,
    });

    return {
      success: true,
      message: `Email verification sent to ${data.to}`,
      timestamp: new Date(),
    };
  }

  /**
   * Handle OTP email
   */
  private async handleSendOtpEmail(data: SendOtpEmailDto): Promise<JobResult> {
    await this.mailHelper.sendMail(
      data.to,
      `Your OTP for ${data.purpose} - Consultly`,
      'otp-verification',
      {
        otp: data.otp,
        purpose: data.purpose,
        firstName: data.firstName,
        expiresInMinutes: data.expiresInMinutes,
      },
    );

    return {
      success: true,
      message: `OTP email sent to ${data.to} for ${data.purpose}`,
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
    const maxAttempts = job.opts.attempts || 3;
    const isFinalAttempt = job.attemptsMade >= maxAttempts;

    if (isFinalAttempt) {
      this.logger.error(
        `🚨 [DLQ] Email Job [${job.id}] permanently failed | name=${job.name} | attempts=${job.attemptsMade} | error=${error.message} | data=${JSON.stringify(job.data)}`,
      );
    } else {
      this.logger.warn(
        `❌ Email Job [${job.id}] failed (attempt ${job.attemptsMade}/${maxAttempts}): ${error.message}`,
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
