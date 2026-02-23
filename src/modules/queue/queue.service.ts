import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import { Queues, QueueKey, JobKey, getJobName, getQueueName } from './queue.constants';
import { JobPayloadMap, AddJobParams, JobOptionsType, QueueStats, JobInfo } from './queue.types';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Map<string, Queue> = new Map();

  constructor(
    @InjectQueue(Queues.QUEUE__EMAIL.name) private readonly emailQueue: Queue,
    @InjectQueue(Queues.QUEUE__SMS.name) private readonly smsQueue: Queue,
    @InjectQueue(Queues.QUEUE__NOTIFICATION.name) private readonly notificationQueue: Queue,
  ) {
    // Map queue names to queue instances for dynamic access
    this.queues.set(Queues.QUEUE__EMAIL.name, this.emailQueue);
    this.queues.set(Queues.QUEUE__SMS.name, this.smsQueue);
    this.queues.set(Queues.QUEUE__NOTIFICATION.name, this.notificationQueue);
  }

  onModuleInit() {
    this.logger.log(
      'QueueService initialized with queues: ' + Array.from(this.queues.keys()).join(', '),
    );
  }

  // ============================================================================
  // Job Operations
  // ============================================================================

  /**
   * Add a job to a queue with full type safety
   * @example
   * await queueService.addJob({
   *   queue: 'QUEUE__EMAIL',
   *   job: 'SEND_EMAIL',
   *   data: { to: 'user@example.com', subject: 'Hello', templateName: 'welcome' }
   * });
   */
  async addJob<Q extends QueueKey, J extends JobKey<Q>>(
    params: AddJobParams<Q, J extends keyof JobPayloadMap[Q] ? J : never>,
  ): Promise<Job> {
    const queueName = getQueueName(params.queue);
    const jobName = getJobName(params.queue, params.job);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(
        `Queue "${queueName}" not found. Available queues: ${Array.from(this.queues.keys()).join(', ')}`,
      );
    }

    const jobOptions: JobsOptions = {
      ...params.options,
    };

    this.logger.log(`Adding job "${jobName}" to queue "${queueName}"`);

    const job = await queue.add(jobName, params.data, jobOptions);

    this.logger.debug(`Job ${job.id} added successfully`);

    return job;
  }

  /**
   * Add a job with a delay
   */
  async addDelayedJob<Q extends QueueKey, J extends JobKey<Q>>(
    params: Omit<AddJobParams<Q, J extends keyof JobPayloadMap[Q] ? J : never>, 'options'>,
    delayMs: number,
  ): Promise<Job> {
    return this.addJob({
      ...params,
      options: { delay: delayMs },
    } as AddJobParams<Q, J extends keyof JobPayloadMap[Q] ? J : never>);
  }

  /**
   * Add a high-priority job
   */
  async addPriorityJob<Q extends QueueKey, J extends JobKey<Q>>(
    params: Omit<AddJobParams<Q, J extends keyof JobPayloadMap[Q] ? J : never>, 'options'>,
    priority: number = 1,
  ): Promise<Job> {
    return this.addJob({
      ...params,
      options: { priority },
    } as AddJobParams<Q, J extends keyof JobPayloadMap[Q] ? J : never>);
  }

  /**
   * Add multiple jobs to a queue (bulk insert)
   */
  async addBulkJobs<Q extends QueueKey, J extends JobKey<Q>>(
    queueKey: Q,
    jobKey: J,
    dataArray: JobPayloadMap[Q][J extends keyof JobPayloadMap[Q] ? J : never][],
    options?: JobOptionsType,
  ): Promise<Job[]> {
    const queueName = getQueueName(queueKey);
    const jobName = getJobName(queueKey, jobKey);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue "${queueName}" not found`);
    }

    const bulkData = dataArray.map((data) => ({
      name: jobName,
      data,
      opts: options,
    }));

    this.logger.log(`Adding ${bulkData.length} bulk jobs "${jobName}" to queue "${queueName}"`);

    return queue.addBulk(bulkData);
  }

  // ============================================================================
  // Job Retrieval
  // ============================================================================

  /**
   * Get a job by ID from a specific queue
   */
  async getJob<Q extends QueueKey>(queueKey: Q, jobId: string): Promise<Job | undefined> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);
    return queue?.getJob(jobId);
  }

  /**
   * Get job information
   */
  async getJobInfo<Q extends QueueKey>(queueKey: Q, jobId: string): Promise<JobInfo | null> {
    const job = await this.getJob(queueKey, jobId);
    if (!job) return null;

    const progress = job.progress;
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: typeof progress === 'number' || typeof progress === 'object' ? progress : 0,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }

  /**
   * Get jobs by state from a queue
   */
  async getJobsByState<Q extends QueueKey>(
    queueKey: Q,
    state: 'completed' | 'failed' | 'delayed' | 'active' | 'waiting',
    start: number = 0,
    end: number = 10,
  ): Promise<Job[]> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);
    if (!queue) return [];

    return queue.getJobs([state], start, end);
  }

  // ============================================================================
  // Queue Statistics
  // ============================================================================

  /**
   * Get statistics for a specific queue
   */
  async getQueueStats<Q extends QueueKey>(queueKey: Q): Promise<QueueStats | null> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);

    if (!queue) return null;

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Get statistics for all queues
   */
  async getAllQueuesStats(): Promise<QueueStats[]> {
    const queueKeys = Object.keys(Queues) as QueueKey[];
    const statsPromises = queueKeys.map((key) => this.getQueueStats(key));
    const stats = await Promise.all(statsPromises);
    return stats.filter((s): s is QueueStats => s !== null);
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Pause a queue
   */
  async pauseQueue<Q extends QueueKey>(queueKey: Q): Promise<void> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      this.logger.warn(`Queue "${queueName}" paused`);
    }
  }

  /**
   * Resume a paused queue
   */
  async resumeQueue<Q extends QueueKey>(queueKey: Q): Promise<void> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      this.logger.log(`Queue "${queueName}" resumed`);
    }
  }

  /**
   * Clean old jobs from a queue
   */
  async cleanQueue<Q extends QueueKey>(
    queueKey: Q,
    gracePeriodMs: number = 24 * 60 * 60 * 1000, // 24 hours
    status: 'completed' | 'failed' = 'completed',
    limit: number = 1000,
  ): Promise<string[]> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);
    if (!queue) return [];

    const cleaned = await queue.clean(gracePeriodMs, limit, status);
    this.logger.log(`Cleaned ${cleaned.length} ${status} jobs from queue "${queueName}"`);
    return cleaned;
  }

  /**
   * Obliterate a queue (remove all jobs and data)
   * Use with caution!
   */
  async obliterateQueue<Q extends QueueKey>(queueKey: Q): Promise<void> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.obliterate({ force: true });
      this.logger.warn(`Queue "${queueName}" obliterated`);
    }
  }

  /**
   * Retry all failed jobs in a queue
   */
  async retryFailedJobs<Q extends QueueKey>(queueKey: Q): Promise<number> {
    const queueName = getQueueName(queueKey);
    const queue = this.queues.get(queueName);
    if (!queue) return 0;

    const failedJobs = await queue.getJobs(['failed']);
    let retried = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retried++;
      } catch (error) {
        this.logger.error(`Failed to retry job ${job.id}: ${error}`);
      }
    }

    this.logger.log(`Retried ${retried} failed jobs in queue "${queueName}"`);
    return retried;
  }
}
