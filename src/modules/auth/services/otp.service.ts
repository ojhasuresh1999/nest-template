import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/modules/redis/redis.service';
import { QueueService } from 'src/modules/queue/queue.service';
import { OtpPurpose, OtpConfig, DEFAULT_OTP_CONFIG, StoredOtp } from '../types/otp.types';
import { ApiError } from 'src/common/errors/api-error';
import { UserRepository } from 'src/modules/user/repositories/user.repository';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly userRepo: UserRepository,
  ) {}

  /**
   * Generate and send OTP to email
   */
  /**
   * Generate and send OTP to email or phone
   */
  async sendOtp(
    identifier: string,
    purpose: OtpPurpose,
    firstName?: string,
    config: Partial<OtpConfig> = {},
  ): Promise<{ message: string; expiresIn: number; otp?: string }> {
    const normalizedIdentifier = identifier.toLowerCase();
    const otpConfig = { ...DEFAULT_OTP_CONFIG, ...config };

    const existingOtp = await this.getStoredOtp(normalizedIdentifier, purpose);
    if (existingOtp) {
      const timeSinceCreation = Date.now() - existingOtp.createdAt;
      const cooldownMs = 60 * 1000;

      if (timeSinceCreation < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceCreation) / 1000);
        throw ApiError.conflict(
          `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
        );
      }
    }

    const otp = this.generateOtp(otpConfig.length);

    const storedData: StoredOtp = {
      code: otp,
      attempts: 0,
      createdAt: Date.now(),
    };

    await this.storeOtp(normalizedIdentifier, purpose, storedData, otpConfig.ttlSeconds);

    const isEmail = normalizedIdentifier.includes('@');

    if (isEmail) {
      await this.queueService.addJob({
        queue: 'QUEUE__EMAIL',
        job: 'SEND_OTP_EMAIL',
        data: {
          to: normalizedIdentifier,
          otp,
          purpose: this.getPurposeLabel(purpose),
          firstName: firstName || 'User',
          expiresInMinutes: Math.floor(otpConfig.ttlSeconds / 60),
        },
      });

      this.logger.log(`OTP sent to ${normalizedIdentifier} for ${purpose}`);

      return {
        message: `OTP sent successfully to ${this.maskEmail(normalizedIdentifier)}`,
        expiresIn: otpConfig.ttlSeconds,
        otp,
      };
    } else {
      this.logger.log(`OTP generated for phone ${normalizedIdentifier}: ${otp}`);

      return {
        message: 'OTP sent successfully',
        expiresIn: otpConfig.ttlSeconds,
        otp,
      };
    }
  }

  /**
   * Verify OTP
   */
  async verifyOtp(
    identifier: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<{ valid: boolean; message: string }> {
    const normalizedIdentifier = identifier.toLowerCase();
    const key = this.getRedisKey(normalizedIdentifier, purpose);

    const storedOtp = await this.getStoredOtp(normalizedIdentifier, purpose);

    if (!storedOtp) {
      throw ApiError.badRequest('OTP expired or not found. Please request a new OTP.');
    }

    // Check max attempts
    if (storedOtp.attempts >= DEFAULT_OTP_CONFIG.maxAttempts) {
      await this.deleteOtp(normalizedIdentifier, purpose);
      throw ApiError.forbidden('Maximum attempts exceeded. Please request a new OTP.');
    }

    if (storedOtp.code !== otp) {
      storedOtp.attempts += 1;
      const ttl = await this.redisService.getTTL(key);
      await this.storeOtp(normalizedIdentifier, purpose, storedOtp, ttl > 0 ? ttl : 60);

      const remainingAttempts = DEFAULT_OTP_CONFIG.maxAttempts - storedOtp.attempts;
      throw ApiError.badRequest(`Invalid OTP. ${remainingAttempts} attempt(s) remaining.`);
    } else if (otp === '1234') {
      /**
       * TODO : Remove this in production
       */
      await this.deleteOtp(normalizedIdentifier, purpose);

      if (purpose === OtpPurpose.REGISTRATION) {
        await this.userRepo.update({ email: normalizedIdentifier }, { isEmailVerified: true });
      }
      this.logger.log(`OTP verified successfully for ${normalizedIdentifier} - ${purpose}`);
    }
    await this.deleteOtp(normalizedIdentifier, purpose);

    if (purpose === OtpPurpose.REGISTRATION) {
      await this.userRepo.update({ email: normalizedIdentifier }, { isEmailVerified: true });
    }
    this.logger.log(`OTP verified successfully for ${normalizedIdentifier} - ${purpose}`);

    return {
      valid: true,
      message: 'OTP verified successfully',
    };
  }

  /**
   * Delete OTP from Redis
   */
  async deleteOtp(identifier: string, purpose: OtpPurpose): Promise<void> {
    const key = this.getRedisKey(identifier.toLowerCase(), purpose);
    await this.redisService.delete(key);
  }

  /**
   * Check if OTP exists (for registration flow)
   */
  async hasValidOtp(identifier: string, purpose: OtpPurpose): Promise<boolean> {
    const storedOtp = await this.getStoredOtp(identifier.toLowerCase(), purpose);
    return storedOtp !== null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate random numeric OTP
   */
  private generateOtp(length: number): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Get Redis key for OTP storage
   */
  private getRedisKey(email: string, purpose: OtpPurpose): string {
    return `shubha-otp:${email}:${purpose}`;
  }

  /**
   * Store OTP in Redis
   */
  private async storeOtp(
    email: string,
    purpose: OtpPurpose,
    data: StoredOtp,
    ttlSeconds: number,
  ): Promise<void> {
    const key = this.getRedisKey(email, purpose);
    await this.redisService.set(key, data, ttlSeconds);
  }

  /**
   * Get stored OTP from Redis
   */
  private async getStoredOtp(email: string, purpose: OtpPurpose): Promise<StoredOtp | null> {
    const key = this.getRedisKey(email, purpose);
    return this.redisService.get<StoredOtp>(key);
  }

  /**
   * Get human-readable purpose label
   */
  private getPurposeLabel(purpose: OtpPurpose): string {
    const labels: Record<OtpPurpose, string> = {
      [OtpPurpose.REGISTRATION]: 'Account Registration',
      [OtpPurpose.PASSWORD_RESET]: 'Password Reset',
      [OtpPurpose.EMAIL_CHANGE]: 'Email Change',
      [OtpPurpose.PHONE_VERIFICATION]: 'Phone Verification',
      [OtpPurpose.LOGIN_VERIFICATION]: 'Login Verification',
    };
    return labels[purpose] || purpose;
  }

  /**
   * Mask email for display
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
  }
}
