import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Queues } from '../queue.constants';
import { SendSmsDto, SendOtpDto } from '../dto';
import type { JobResult } from '../queue.types';

/**
 * SMS Queue Processor
 * Handles all SMS-related background jobs
 *
 * TODO: Integrate with actual SMS provider (Twilio, AWS SNS, MSG91, etc.)
 */
@Processor(Queues.QUEUE__SMS.name, {
  concurrency: 3,
  limiter: {
    max: 5,
    duration: 1000, // Max 5 SMS per second
  },
})
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);
  private readonly jobs = Queues.QUEUE__SMS.jobs;
  /**
   * TODO : Inject SMS provider service
   */
  // constructor(private readonly smsProvider: SmsProviderService) {
  //   super();
  // }

  /**
   * Main job processing method
   */
  async process(job: Job): Promise<JobResult> {
    this.logger.log(`Processing SMS job [${job.id}] - ${job.name}`);

    try {
      await job.updateProgress(10);

      let result: JobResult;

      switch (job.name) {
        case this.jobs.SEND_SMS.name:
          result = await this.handleSendSms(job.data as SendSmsDto);
          break;

        case this.jobs.SEND_OTP.name:
          result = await this.handleSendOtp(job.data as SendOtpDto);
          break;

        default:
          throw new Error(`Unknown SMS job type: ${job.name}`);
      }

      await job.updateProgress(100);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `SMS Job [${job.id}] failed (attempt ${job.attemptsMade}/${job.opts.attempts || 5}): ${errorMessage}`,
        errorStack,
      );

      throw error;
    }
  }

  // ============================================================================
  // Job Handlers
  // ============================================================================

  /**
   * Handle generic SMS sending
   */
  private async handleSendSms(data: SendSmsDto): Promise<JobResult> {
    /**
     * TODO : Replace with actual SMS provider integration
     */
    this.logger.log(`[MOCK SMS] To: ${data.phoneNumber}, Message: ${data.message}`);

    // Simulate API call delay
    await this.simulateApiCall();

    // Example actual implementation:
    // await this.smsProvider.send({
    //   to: data.phoneNumber,
    //   message: data.message,
    // });

    return {
      success: true,
      message: `SMS sent to ${data.phoneNumber}`,
      timestamp: new Date(),
      data: {
        phoneNumber: this.maskPhoneNumber(data.phoneNumber),
      },
    };
  }

  /**
   * Handle OTP SMS sending
   */
  private async handleSendOtp(data: SendOtpDto): Promise<JobResult> {
    /**
     * TODO : Replace with actual SMS provider integration
     */
    // Message format for actual implementation:
    // const message = `Your OTP is: ${data.code}. Valid for ${data.expiresInMinutes} minutes. Do not share this with anyone.`;

    this.logger.log(`[MOCK OTP] To: ${data.phoneNumber}, Code: ${data.code}`);

    await this.simulateApiCall();

    // Example actual implementation:
    // await this.smsProvider.sendOtp({
    //   to: data.phoneNumber,
    //   code: data.code,
    //   template: 'OTP_TEMPLATE',
    //   expiry: data.expiresInMinutes,
    // });

    return {
      success: true,
      message: `OTP sent to ${this.maskPhoneNumber(data.phoneNumber)}`,
      timestamp: new Date(),
      data: {
        phoneNumber: this.maskPhoneNumber(data.phoneNumber),
        expiresInMinutes: data.expiresInMinutes,
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
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return '****';
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }

  // ============================================================================
  // Worker Events
  // ============================================================================

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: JobResult) {
    this.logger.log(`✅ SMS Job [${job.id}] completed: ${result.message}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `❌ SMS Job [${job.id}] failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number | object) {
    const progressValue = typeof progress === 'number' ? progress : JSON.stringify(progress);
    this.logger.debug(`📊 SMS Job [${job.id}] progress: ${progressValue}%`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`🚀 SMS Job [${job.id}] started processing`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`⚠️ SMS Job [${jobId}] stalled`);
  }
}
