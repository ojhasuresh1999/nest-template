import type { JobsOptions } from 'bullmq';
import type {
  SendEmailDto,
  SendBulkEmailDto,
  SendWelcomeEmailDto,
  SendPasswordResetDto,
  SendEmailVerificationDto,
  SendOtpEmailDto,
  SendSmsDto,
  SendOtpDto,
  SendPushDto,
  SendInAppDto,
} from './dto';

// ============================================================================
// Job Payload Type Mapping
// ============================================================================

/**
 * Maps each queue's jobs to their expected payload types
 * This provides compile-time type safety when adding jobs to queues
 */
export type JobPayloadMap = {
  QUEUE__EMAIL: {
    SEND_EMAIL: SendEmailDto;
    SEND_BULK_EMAIL: SendBulkEmailDto;
    SEND_WELCOME_EMAIL: SendWelcomeEmailDto;
    SEND_PASSWORD_RESET: SendPasswordResetDto;
    SEND_EMAIL_VERIFICATION: SendEmailVerificationDto;
    SEND_OTP_EMAIL: SendOtpEmailDto;
  };
  QUEUE__SMS: {
    SEND_SMS: SendSmsDto;
    SEND_OTP: SendOtpDto;
  };
  QUEUE__NOTIFICATION: {
    SEND_PUSH: SendPushDto;
    SEND_IN_APP: SendInAppDto;
  };
};

// ============================================================================
// Job Operation Types
// ============================================================================

/**
 * Options that can be passed when adding a job
 */
export type JobOptionsType = Pick<
  JobsOptions,
  'delay' | 'priority' | 'attempts' | 'jobId' | 'repeat' | 'backoff'
>;

/**
 * Type-safe parameters for adding a job to a queue
 */
export type AddJobParams<Q extends keyof JobPayloadMap, J extends keyof JobPayloadMap[Q]> = {
  /** Queue key (e.g., 'QUEUE__EMAIL') */
  queue: Q;
  /** Job key within the queue (e.g., 'SEND_EMAIL') */
  job: J;
  /** Job payload data - type is inferred from queue and job */
  data: JobPayloadMap[Q][J];
  /** Optional job options (delay, priority, etc.) */
  options?: JobOptionsType;
};

/**
 * Result returned by job processors
 */
export interface JobResult {
  /** Whether the job completed successfully */
  success: boolean;
  /** Human-readable result message */
  message?: string;
  /** Error message if job failed */
  error?: string;
  /** When the job completed */
  timestamp: Date;
  /** Additional result data */
  data?: Record<string, unknown>;
}

// ============================================================================
// Queue Statistics Types
// ============================================================================

/**
 * Statistics for a single queue
 */
export interface QueueStats {
  /** Queue name */
  name: string;
  /** Number of jobs waiting to be processed */
  waiting: number;
  /** Number of currently active jobs */
  active: number;
  /** Number of completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of delayed jobs */
  delayed: number;
}

/**
 * Job information
 */
export interface JobInfo {
  id: string | undefined;
  name: string;
  data: unknown;
  progress: number | object;
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  returnvalue?: unknown;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid queue key
 */
export function isValidQueueKey(key: string): key is keyof JobPayloadMap {
  return ['QUEUE__EMAIL', 'QUEUE__SMS', 'QUEUE__NOTIFICATION'].includes(key);
}

/**
 * Type guard to check if a result indicates success
 */
export function isSuccessResult(result: JobResult): boolean {
  return result.success === true;
}
