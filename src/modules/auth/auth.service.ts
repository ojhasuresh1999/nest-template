import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StatusEnum, UserRole } from 'src/common/enums';
import { ApiError } from 'src/common/errors/api-error';
import { AllConfigType } from '../../config/config.types';
import { securityLogger } from '../../security-logger';
import { RoleRepository } from '../role/repositories/role.repository';
import { UserRepository } from '../user/repositories/user.repository';
import { UserDocument } from '../user/schemas/user.schema';
import {
  AdminLoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDataDto,
  RegisterDto,
  ResetPasswordDto,
  TokensDto,
  UserLoginDto,
} from './dto';
import { SeverityLevel, SuspiciousActivityType } from './schemas/suspicious-activity.schema';
import { DeviceInfo, DeviceSessionService } from './services/device-session.service';
import { OtpService } from './services/otp.service';
import { SuspiciousActivityService } from './services/suspicious-activity.service';
import { RefreshTokenPayload } from './strategies/jwt-refresh.strategy';
import { JwtPayload } from './strategies/jwt.strategy';
import { OtpPurpose } from './types';

@Injectable()
export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService<AllConfigType>,
    private deviceSessionService: DeviceSessionService,
    private suspiciousActivityService: SuspiciousActivityService,
    private otpService: OtpService,
    private readonly roleRepo: RoleRepository,
  ) {}

  async register(dto: RegisterDto): Promise<{ expiresIn: number; otp?: string }> {
    const existingUser = await this.userRepo.findOne({
      email: dto.email.toLowerCase(),
      isDeleted: false,
    });

    if (existingUser) {
      throw ApiError.conflict('Email already registered');
    }

    const existingPhone = await this.userRepo.findOne({
      phone: dto.phone,
      isDeleted: false,
    });

    if (existingPhone) {
      throw ApiError.conflict('Phone number already registered');
    }

    const role = await this.roleRepo.findOne(
      { name: UserRole.USER, status: StatusEnum.ACTIVE },
      { _id: 1 },
    );

    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    const user = await this.userRepo.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      password: dto.password,
      role: role._id,
    });

    securityLogger.info('New user registered', {
      email: dto.email.toLowerCase(),
      userId: user._id.toString(),
    });

    const result = await this.otpService.sendOtp(
      dto.email,
      OtpPurpose.REGISTRATION,
      user.firstName,
    );
    return { expiresIn: result.expiresIn, otp: result.otp };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ otp?: string; expiresIn: number }> {
    const user = await this.userRepo.findOne({
      phone: dto.phone,
      isDeleted: false,
    });

    if (!user) {
      throw ApiError.notFound('User not found with this phone number');
    }

    const result = await this.otpService.sendOtp(
      dto.phone,
      OtpPurpose.PASSWORD_RESET,
      user.firstName,
    );
    return result;
  }

  async verifyOtp(
    identifier: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<{ verificationToken: string }> {
    await this.otpService.verifyOtp(identifier, otp, purpose);

    const verificationToken = this.jwtService.sign(
      { identifier, purpose },
      {
        secret: this.configService.getOrThrow('auth.jwtSecret', { infer: true }),
        expiresIn: '5m',
      },
    );

    return {
      verificationToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const payload = this.verifyVerificationToken(dto.verificationToken, OtpPurpose.PASSWORD_RESET);

    const user = await this.userRepo.findOne({
      phone: payload.identifier,
      isDeleted: false,
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (await user.comparePassword(dto.password)) {
      throw ApiError.badRequest('New password cannot be the same as the old password');
    }

    user.password = dto.password;
    await user.save();

    await this.deviceSessionService.revokeAllSessions(user._id.toString());
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isPasswordValid = await user.comparePassword(dto.oldPassword);
    if (!isPasswordValid) {
      throw ApiError.badRequest('Invalid old password');
    }

    if (await user.comparePassword(dto.newPassword)) {
      throw ApiError.badRequest('New password cannot be the same as the old password');
    }

    user.password = dto.newPassword;
    await user.save();

    securityLogger.info('User changed password', { userId });
  }

  async adminLogin(dto: AdminLoginDto, deviceInfo: DeviceInfo): Promise<LoginDataDto> {
    const normalizedEmail = dto.email.toLowerCase();

    const lockStatus = await this.suspiciousActivityService.isAccountLocked(
      normalizedEmail,
      deviceInfo.ipAddress,
    );

    if (lockStatus.isLocked) {
      throw ApiError.forbidden(
        `Account temporarily locked. Try again after ${lockStatus.lockoutUntil?.toISOString()}`,
      );
    }

    const user = await this.userRepo.findOne({
      email: normalizedEmail,
      isDeleted: false,
    });

    if (!user) {
      await this.handleFailedLogin(normalizedEmail, deviceInfo);
      throw ApiError.notFound('User not found with this email');
    }

    const role = await this.roleRepo.findById(user.role?.toString());
    if (!role || (role.name !== UserRole.ADMIN && role.name !== UserRole.SUPER_ADMIN)) {
      throw ApiError.forbidden('Access denied. Admin credentials required.');
    }

    if (user.status === StatusEnum.INACTIVE) {
      throw ApiError.badRequest('Admin account is inactive.');
    }

    const isPasswordValid = await user.comparePassword(dto.password);
    if (!isPasswordValid) {
      await this.handleFailedLogin(normalizedEmail, deviceInfo, user._id.toString());
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = await this.generateTokens(user, deviceInfo);

    securityLogger.info('Admin login successful', {
      email: normalizedEmail,
      userId: user._id.toString(),
    });

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
        phone: user.phone,
        profileImage: user.profileImage || '',
        role: user.role ? user.role.toString() : null,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  async userLogin(dto: UserLoginDto, deviceInfo: DeviceInfo): Promise<LoginDataDto> {
    let user: UserDocument | null = null;
    let identifier: string = '';

    if (dto.phone) {
      identifier = dto.phone;
      user = await this.userRepo.findOne({ phone: dto.phone, isDeleted: false });
    } else if (dto.email) {
      identifier = dto.email.toLowerCase();
      user = await this.userRepo.findOne({ email: identifier, isDeleted: false });
    }

    if (!identifier) {
      throw ApiError.badRequest('Email or phone is required');
    }

    const lockStatus = await this.suspiciousActivityService.isAccountLocked(
      identifier,
      deviceInfo.ipAddress,
    );

    if (lockStatus.isLocked) {
      throw ApiError.forbidden(
        `Account temporarily locked. Try again after ${lockStatus.lockoutUntil?.toISOString()}`,
      );
    }

    if (!user) {
      await this.handleFailedLogin(identifier, deviceInfo);
      throw ApiError.notFound(`User not found with this ${dto.phone ? 'phone number' : 'email'}`);
    }

    if (user.status === StatusEnum.INACTIVE) {
      throw ApiError.badRequest('User account is inactive.');
    }

    await this.otpService.verifyOtp(identifier, dto.otp, OtpPurpose.LOGIN_VERIFICATION);

    const tokens = await this.generateTokens(user, deviceInfo);

    securityLogger.info('User login successful', {
      identifier,
      userId: user._id.toString(),
    });

    return {
      ...tokens,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
        phone: user.phone,
        profileImage: user.profileImage || '',
        role: user.role ? user.role.toString() : null,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  async refreshTokens(userId: string, deviceId: string, refreshToken: string): Promise<TokensDto> {
    const isValid = await this.deviceSessionService.validateRefreshToken(
      userId,
      deviceId,
      refreshToken,
    );

    if (!isValid) {
      securityLogger.warn('Invalid refresh token attempt', {
        userId,
        deviceId,
      });
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const user = await this.userRepo.findById(userId);

    if (!user || user.isDeleted || user.status !== 'Active') {
      throw ApiError.unauthorized('User not found or inactive');
    }

    // Get rememberMe status from session
    const rememberMe = await this.deviceSessionService.getSessionRememberMe(userId, deviceId);

    const refreshExpiration = rememberMe
      ? this.configService.get('auth.jwtRememberMeExpiration', { infer: true }) || '30d'
      : this.configService.get('auth.jwtRefreshExpirationShort', { infer: true }) || '1d';

    // Generate new tokens
    const accessToken = this.generateAccessToken(user, deviceId);
    const newRefreshToken = this.generateRefreshToken(
      user._id.toString(),
      deviceId,
      refreshExpiration,
    );

    // Update session with new refresh token
    await this.deviceSessionService.updateSession(
      userId,
      deviceId,
      newRefreshToken,
      refreshExpiration,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn:
        this.configService.get('auth.jwtAccessExpiration', {
          infer: true,
        }) || '15m',
    };
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    const revoked = await this.deviceSessionService.revokeSession(userId, deviceId);

    if (!revoked) {
      throw ApiError.unauthorized('Session not found');
    }
  }

  async logoutAll(
    userId: string,
    currentDeviceId?: string,
    includeCurrentDevice = true,
  ): Promise<{ revokedCount: number }> {
    const revokedCount = await this.deviceSessionService.revokeAllSessions(
      userId,
      includeCurrentDevice ? undefined : currentDeviceId,
    );

    return {
      revokedCount,
    };
  }

  async getActiveSessions(userId: string, currentDeviceId: string) {
    const sessions = await this.deviceSessionService.getActiveSessions(userId, currentDeviceId);

    return {
      sessions,
      totalCount: sessions.length,
    };
  }

  async revokeSession(
    userId: string,
    targetDeviceId: string,
    currentDeviceId: string,
  ): Promise<void> {
    if (targetDeviceId === currentDeviceId) {
      throw ApiError.forbidden('Cannot revoke current session. Use logout instead.');
    }

    const revoked = await this.deviceSessionService.revokeSession(userId, targetDeviceId);

    if (!revoked) {
      throw ApiError.unauthorized('Session not found');
    }
  }

  private async generateTokens(user: UserDocument, deviceInfo: DeviceInfo): Promise<TokensDto> {
    const refreshExpiration = deviceInfo.rememberMe
      ? this.configService.get('auth.jwtRememberMeExpiration', { infer: true }) || '30d'
      : this.configService.get('auth.jwtRefreshExpirationShort', { infer: true }) || '1d';

    const refreshToken = this.generateRefreshToken(user._id.toString(), '', refreshExpiration);
    const { deviceId } = await this.deviceSessionService.createSession(
      user._id.toString(),
      refreshToken,
      deviceInfo,
      refreshExpiration,
    );

    const accessToken = this.generateAccessToken(user, deviceId);
    const finalRefreshToken = this.generateRefreshToken(
      user._id.toString(),
      deviceId,
      refreshExpiration,
    );

    await this.deviceSessionService.updateSession(
      user._id.toString(),
      deviceId,
      finalRefreshToken,
      refreshExpiration,
    );

    return {
      accessToken,
      refreshToken: finalRefreshToken,
      tokenType: 'Bearer',
      expiresIn:
        this.configService.get('auth.jwtAccessExpiration', {
          infer: true,
        }) || '15m',
    };
  }

  private generateAccessToken(user: UserDocument, deviceId: string): string {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      deviceId,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('auth.jwtSecret', { infer: true }),
      expiresIn:
        this.configService.get('auth.jwtAccessExpiration', {
          infer: true,
        }) || '15m',
    });
  }

  private generateRefreshToken(userId: string, deviceId: string, expiresIn: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      deviceId,
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow('auth.jwtRefreshSecret', {
        infer: true,
      }),
      expiresIn: expiresIn as any,
    });
  }

  private async handleFailedLogin(
    identifier: string,
    deviceInfo: DeviceInfo,
    userId?: string,
  ): Promise<void> {
    const result = await this.suspiciousActivityService.recordFailedLogin(
      identifier,
      deviceInfo.ipAddress,
      deviceInfo.userAgent,
    );

    if (result.isLocked) {
      await this.suspiciousActivityService.logActivity(
        SuspiciousActivityType.BRUTE_FORCE,
        SeverityLevel.CRITICAL,
        deviceInfo,
        userId,
        identifier,
      );
    } else {
      await this.suspiciousActivityService.logActivity(
        SuspiciousActivityType.FAILED_LOGIN,
        SeverityLevel.LOW,
        {
          ...deviceInfo,
          details: { remainingAttempts: result.remainingAttempts },
        },
        userId,
        identifier,
      );
    }
  }

  private verifyVerificationToken(
    token: string,
    purpose: OtpPurpose,
  ): { identifier: string; purpose: OtpPurpose } {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow('auth.jwtSecret', { infer: true }),
      });

      if (payload.purpose !== purpose) {
        throw ApiError.badRequest('Invalid token purpose');
      }

      return payload;
    } catch {
      throw ApiError.badRequest('Invalid or expired verification token');
    }
  }

  async detailsByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepo.findOne({ email });
  }
}
