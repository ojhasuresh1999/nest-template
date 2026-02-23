import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { AllConfigType } from 'src/config/config.types';
import { securityLogger } from 'src/security-logger';
import { LoginAttemptRepository, SuspiciousActivityRepository } from '../repositories';
import {
  SeverityLevel,
  SuspiciousActivityDocument,
  SuspiciousActivityType,
} from '../schemas/suspicious-activity.schema';

export interface ActivityDetails {
  ipAddress: string;
  userAgent: string;
  location?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class SuspiciousActivityService {
  constructor(
    private suspiciousActivityRepo: SuspiciousActivityRepository,
    private loginAttemptRepo: LoginAttemptRepository,
    private configService: ConfigService<AllConfigType>,
  ) {}

  async logActivity(
    type: SuspiciousActivityType,
    severity: SeverityLevel,
    activityDetails: ActivityDetails,
    userId?: string,
    identifier?: string,
  ): Promise<void> {
    await this.suspiciousActivityRepo.create({
      userId: userId ? new Types.ObjectId(userId) : undefined,
      identifier,
      activityType: type,
      severity,
      ipAddress: activityDetails.ipAddress,
      userAgent: activityDetails.userAgent,
      location: activityDetails.location || '',
      details: activityDetails.details || {},
      isResolved: false,
    });

    securityLogger.warn(`Suspicious activity detected: ${type}`, {
      userId,
      identifier,
      severity,
      ipAddress: activityDetails.ipAddress,
      details: activityDetails.details,
    });
  }

  async recordFailedLogin(
    identifier: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{
    isLocked: boolean;
    remainingAttempts: number;
    lockoutUntil?: Date;
  }> {
    const maxAttempts =
      this.configService.get('auth.maxLoginAttempts', {
        infer: true,
      }) || 5;
    const lockoutMinutes =
      this.configService.get('auth.lockoutDurationMinutes', {
        infer: true,
      }) || 15;

    let attempt = await this.loginAttemptRepo.findOne({ identifier, ipAddress });

    if (!attempt) {
      attempt = await this.loginAttemptRepo.create({
        identifier,
        ipAddress,
        attempts: 1,
        lastAttemptAt: new Date(),
      });

      return {
        isLocked: false,
        remainingAttempts: maxAttempts - 1,
      };
    }

    if (attempt.lockedUntil && attempt.lockedUntil > new Date()) {
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutUntil: attempt.lockedUntil,
      };
    }

    if (attempt.lockedUntil && attempt.lockedUntil <= new Date()) {
      attempt.attempts = 0;
      attempt.lockedUntil = undefined as unknown as Date;
    }

    attempt.attempts += 1;
    attempt.lastAttemptAt = new Date();

    if (attempt.attempts >= maxAttempts) {
      attempt.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);

      await this.logActivity(
        SuspiciousActivityType.ACCOUNT_LOCKED,
        SeverityLevel.HIGH,
        { ipAddress, userAgent },
        undefined,
        identifier,
      );

      securityLogger.error('Account locked due to failed login attempts', {
        identifier,
        ipAddress,
        attempts: attempt.attempts,
        lockedUntil: attempt.lockedUntil,
      });
    }

    await attempt.save();

    return {
      isLocked: attempt.attempts >= maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - attempt.attempts),
      lockoutUntil: attempt.lockedUntil,
    };
  }

  async isAccountLocked(
    identifier: string,
    ipAddress: string,
  ): Promise<{ isLocked: boolean; lockoutUntil?: Date }> {
    const attempt = await this.loginAttemptRepo.findOne({ identifier, ipAddress });

    if (!attempt || !attempt.lockedUntil) {
      return { isLocked: false };
    }

    if (attempt.lockedUntil > new Date()) {
      return { isLocked: true, lockoutUntil: attempt.lockedUntil };
    }

    return { isLocked: false };
  }

  async clearLoginAttempts(identifier: string, ipAddress: string): Promise<void> {
    await this.loginAttemptRepo.delete({ identifier, ipAddress });
  }

  async logNewDeviceLogin(
    userId: string,
    identifier: string,
    activityDetails: ActivityDetails,
  ): Promise<void> {
    await this.logActivity(
      SuspiciousActivityType.NEW_DEVICE,
      SeverityLevel.MEDIUM,
      {
        ...activityDetails,
        details: {
          ...activityDetails.details,
          message: 'Login from new device',
        },
      },
      userId,
      identifier,
    );
  }

  async getUnresolvedActivities(
    userId?: string,
    limit = 50,
  ): Promise<SuspiciousActivityDocument[]> {
    const query: Record<string, unknown> = { isResolved: false };
    if (userId) {
      query.userId = new Types.ObjectId(userId);
    }

    return this.suspiciousActivityRepo.findAll(query, undefined, {
      sort: { createdAt: -1 },
      limit,
    });
  }

  async resolveActivity(activityId: string, resolvedBy: string, notes?: string): Promise<boolean> {
    const result = await this.suspiciousActivityRepo.updateById(activityId, {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy,
      resolutionNotes: notes,
    });

    return !!result;
  }

  async getActivityStats(
    userId?: string,
    days = 30,
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> {
    const matchStage: Record<string, unknown> = {
      createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    };
    if (userId) {
      matchStage.userId = new Types.ObjectId(userId);
    }

    const stats = await this.suspiciousActivityRepo.aggregate([
      { $match: matchStage },
      {
        $facet: {
          byType: [{ $group: { _id: '$activityType', count: { $sum: 1 } } }],
          bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const result = (stats[0] || {
      byType: [],
      bySeverity: [],
      total: [],
    }) as {
      total: { count: number }[];
      byType: { _id: string; count: number }[];
      bySeverity: { _id: string; count: number }[];
    };

    return {
      total: result.total[0]?.count || 0,
      byType: Object.fromEntries(
        (result.byType as Array<{ _id: string; count: number }>).map((item) => [
          item._id,
          item.count,
        ]),
      ),
      bySeverity: Object.fromEntries(
        (result.bySeverity as Array<{ _id: string; count: number }>).map((item) => [
          item._id,
          item.count,
        ]),
      ),
    };
  }
}
