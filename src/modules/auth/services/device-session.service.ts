import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model, Types } from 'mongoose';
import { AllConfigType } from 'src/config/config.types';
import { securityLogger } from 'src/security-logger';
import { generateDeviceFingerprint, parseDeviceInfo } from 'src/utils/device-fingerprint';
import { DeviceSession, DeviceSessionDocument } from '../schemas/device-session.schema';

export interface DeviceInfo {
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  fcmToken?: string;
  rememberMe?: boolean;
}

@Injectable()
export class DeviceSessionService {
  // private readonly logger = new Logger(DeviceSessionService.name);

  constructor(
    @InjectModel(DeviceSession.name)
    private deviceSessionModel: Model<DeviceSessionDocument>,
    private configService: ConfigService<AllConfigType>,
  ) {}

  async createSession(
    userId: string,
    refreshToken: string,
    deviceInfo: DeviceInfo,
    expiresIn: string,
  ): Promise<{ session: DeviceSessionDocument; deviceId: string }> {
    const deviceId = generateDeviceFingerprint(deviceInfo.userAgent, userId);
    const hashedToken = await argon2.hash(refreshToken);
    const expiresAt = this.calculateExpiry(expiresIn);

    const parsedDeviceInfo = parseDeviceInfo(deviceInfo.userAgent);

    const existingSession = await this.deviceSessionModel.findOne({
      userId: new Types.ObjectId(userId),
      deviceId,
    });

    if (existingSession) {
      existingSession.refreshToken = hashedToken;
      existingSession.lastActiveAt = new Date();
      existingSession.expiresAt = expiresAt;
      existingSession.isActive = true;
      existingSession.ipAddress = deviceInfo.ipAddress;
      existingSession.location = deviceInfo.location || '';
      if (deviceInfo.fcmToken) {
        existingSession.fcmToken = deviceInfo.fcmToken;
      }
      // Update rememberMe preference on re-login
      existingSession.rememberMe = deviceInfo.rememberMe || false;
      existingSession.loginCount = (existingSession.loginCount || 0) + 1;
      await existingSession.save();

      securityLogger.info('Existing session updated', {
        userId,
        deviceId,
        deviceName: existingSession.deviceName,
        deviceType: existingSession.deviceType,
        ipAddress: deviceInfo.ipAddress,
      });

      return { session: existingSession, deviceId };
    }

    const maxSessions =
      this.configService.get('auth.maxSessionsPerUser', {
        infer: true,
      }) || 5;

    const existingSessions = await this.deviceSessionModel
      .find({ userId: new Types.ObjectId(userId), isActive: true })
      .sort({ lastActiveAt: 1 })
      .exec();

    if (existingSessions.length >= maxSessions) {
      const oldestSession = existingSessions[0];
      if (oldestSession) {
        await this.revokeSession(userId, oldestSession.deviceId);
        securityLogger.warn('Session limit exceeded, oldest session revoked', {
          userId,
          revokedDeviceId: oldestSession.deviceId,
          deviceName: oldestSession.deviceName,
        });
      }
    }

    const session = await this.deviceSessionModel.create({
      userId: new Types.ObjectId(userId),
      deviceId,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      location: deviceInfo.location || '',
      fcmToken: deviceInfo.fcmToken,
      browserName: parsedDeviceInfo.browserName,
      browserVersion: parsedDeviceInfo.browserVersion,
      osName: parsedDeviceInfo.osName,
      osVersion: parsedDeviceInfo.osVersion,
      deviceVendor: parsedDeviceInfo.deviceVendor,
      deviceModel: parsedDeviceInfo.deviceModel,
      loginCount: 1,
      firstLoginAt: new Date(),
      refreshToken: hashedToken,
      lastActiveAt: new Date(),
      expiresAt,
      rememberMe: deviceInfo.rememberMe || false,
      isActive: true,
    });

    securityLogger.info('New session created', {
      userId,
      deviceId,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      ipAddress: deviceInfo.ipAddress,
    });

    return { session, deviceId };
  }

  async validateRefreshToken(
    userId: string,
    deviceId: string,
    refreshToken: string,
  ): Promise<boolean> {
    const session = await this.deviceSessionModel.findOne({
      userId: new Types.ObjectId(userId),
      deviceId,
      isActive: true,
    });

    if (!session) {
      securityLogger.warn('Session not found for token validation', {
        userId,
        deviceId,
      });
      return false;
    }

    if (session.expiresAt < new Date()) {
      await this.revokeSession(userId, deviceId);
      securityLogger.warn('Session expired during validation', {
        userId,
        deviceId,
      });
      return false;
    }

    const isValid = await argon2.verify(session.refreshToken, refreshToken);

    if (!isValid) {
      securityLogger.warn('Invalid refresh token presented', {
        userId,
        deviceId,
        action: 'POSSIBLE_TOKEN_REUSE',
      });
    }

    return isValid;
  }

  async updateSession(
    userId: string,
    deviceId: string,
    newRefreshToken: string,
    expiresIn: string,
  ): Promise<void> {
    const hashedToken = await argon2.hash(newRefreshToken);
    const expiresAt = this.calculateExpiry(expiresIn);

    await this.deviceSessionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), deviceId, isActive: true },
      {
        refreshToken: hashedToken,
        lastActiveAt: new Date(),
        expiresAt,
      },
    );
  }

  async getSessionRememberMe(userId: string, deviceId: string): Promise<boolean> {
    const session = await this.deviceSessionModel.findOne({
      userId: new Types.ObjectId(userId),
      deviceId,
      isActive: true,
    });

    return session?.rememberMe || false;
  }

  async revokeSession(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.deviceSessionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), deviceId },
      { isActive: false },
    );

    if (result) {
      securityLogger.info('Session revoked', {
        userId,
        deviceId,
        deviceName: result.deviceName,
      });
      return true;
    }

    return false;
  }

  async revokeAllSessions(userId: string, exceptDeviceId?: string): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      isActive: true,
    };

    if (exceptDeviceId) {
      query.deviceId = { $ne: exceptDeviceId };
    }

    const result = await this.deviceSessionModel.updateMany(query, {
      isActive: false,
    });

    securityLogger.info('All sessions revoked', {
      userId,
      exceptDeviceId,
      revokedCount: result.modifiedCount,
    });

    return result.modifiedCount;
  }

  async getActiveSessions(
    userId: string,
    currentDeviceId?: string,
  ): Promise<
    Array<{
      deviceId: string;
      deviceName: string;
      deviceType: string;
      ipAddress: string;
      location: string;
      browserName: string;
      browserVersion: string;
      osName: string;
      osVersion: string;
      deviceVendor: string;
      deviceModel: string;
      loginCount: number;
      firstLoginAt: Date;
      lastActiveAt: Date;
      rememberMe: boolean;
      isCurrent: boolean;
    }>
  > {
    const sessions = await this.deviceSessionModel
      .find({ userId: new Types.ObjectId(userId), isActive: true })
      .sort({ lastActiveAt: -1 })
      .exec();

    return sessions.map((session) => ({
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      ipAddress: session.ipAddress,
      location: session.location,
      browserName: session.browserName || '',
      browserVersion: session.browserVersion || '',
      osName: session.osName || '',
      osVersion: session.osVersion || '',
      deviceVendor: session.deviceVendor || '',
      deviceModel: session.deviceModel || '',
      loginCount: session.loginCount || 0,
      firstLoginAt: session.firstLoginAt || session.lastActiveAt,
      lastActiveAt: session.lastActiveAt,
      rememberMe: session.rememberMe || false,
      isCurrent: session.deviceId === currentDeviceId,
    }));
  }

  async isNewDevice(userId: string, userAgent: string): Promise<boolean> {
    const existingSession = await this.deviceSessionModel.findOne({
      userId: new Types.ObjectId(userId),
      userAgent,
    });

    return !existingSession;
  }

  private calculateExpiry(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      // Default to 7 days
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    let ms = 0;
    switch (unit) {
      case 's':
        ms = value * 1000;
        break;
      case 'm':
        ms = value * 60 * 1000;
        break;
      case 'h':
        ms = value * 60 * 60 * 1000;
        break;
      case 'd':
        ms = value * 24 * 60 * 60 * 1000;
        break;
    }

    return new Date(Date.now() + ms);
  }
}
