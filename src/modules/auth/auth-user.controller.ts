import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RESPONSE_MESSAGES } from 'src/common/constants/response-messages.constant';
import { ApiStandardResponse } from 'src/common/decorators/api-standard-response.decorator';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { UserRole } from 'src/common/enums';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './decorators';
import { CurrentUser, Public, Roles } from './decorators';
import {
  AuthResponseDto,
  RegisterDto,
  SendOtpDto,
  SessionDto,
  TokensDto,
  UserLoginDto,
  VerifyOtpDto,
} from './dto';
import { JwtAuthGuard, JwtRefreshGuard, RolesGuard } from './guards';
import { DeviceInfo } from './services/device-session.service';
import { OtpService } from './services/otp.service';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
@Roles(UserRole.USER)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuthUserController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user account by verifying OTP (sent via send-otp API with REGISTRATION purpose). Returns auth tokens immediately (auto-login).',
  })
  @ApiStandardResponse({
    status: 201,
    description: 'User successfully registered and logged in',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data or OTP' })
  @ApiConflictResponse({ description: 'User already exists with this identifier' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.REGISTER_SUCCESS)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const deviceInfo = this.extractDeviceInfo(req);
    if (dto.fcmToken) {
      deviceInfo.fcmToken = dto.fcmToken;
    }
    if (dto.rememberMe !== undefined) {
      deviceInfo.rememberMe = dto.rememberMe;
    }
    return this.authService.register(dto, deviceInfo);
  }

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: 'Send OTP',
    description:
      'Sends a 4-digit OTP to the specified email or phone number for the given purpose. Use this before register (REGISTRATION), login (LOGIN_VERIFICATION), or other flows.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid identifier format' })
  @ApiConflictResponse({ description: 'Please wait before requesting a new OTP' })
  @ApiTooManyRequestsResponse({ description: 'Too many OTP requests' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.OTP_SENT)
  async sendOtp(@Body() dto: SendOtpDto) {
    const user = await this.authService.detailsByIdentifier(dto.identifier);
    const firstName = user?.firstName;

    return this.otpService.sendOtp(dto.identifier, dto.purpose, firstName);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'Verify OTP',
    description:
      'Verifies OTP and returns a short-lived verification token. Use this for password reset and other flows (NOT for register/login — those verify OTP internally).',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'OTP verified successfully',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid OTP or expired' })
  @ApiForbiddenResponse({ description: 'Maximum attempts exceeded' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.OTP_VERIFIED)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.identifier, dto.otp, dto.purpose);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 2 } })
  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Resends OTP to the same email or phone. Subject to cooldown period.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'OTP resent successfully',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({ description: 'Please wait before requesting a new OTP' })
  @ApiTooManyRequestsResponse({ description: 'Too many OTP requests' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.OTP_SENT)
  async resendOtp(@Body() dto: SendOtpDto) {
    const user = await this.authService.detailsByIdentifier(dto.identifier);
    const firstName = user?.firstName;

    return this.otpService.sendOtp(dto.identifier, dto.purpose, firstName);
  }

  // @Public()
  // @Post('forgot-password')
  // @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { ttl: 60000, limit: 3 } })
  // @ApiOperation({
  //   summary: 'Forgot Password',
  //   description: 'Initiates password reset by sending OTP to the provided email or phone number.',
  // })
  // @ApiStandardResponse({
  //   status: 200,
  //   description: 'OTP sent successfully',
  //   type: AuthResponseDto,
  // })
  // @ApiNotFoundResponse({ description: 'User not found' })
  // @ResponseMessage(RESPONSE_MESSAGES.AUTH.OTP_SENT)
  // async forgotPassword(@Body() dto: ForgotPasswordDto) {
  //   return this.authService.forgotPassword(dto);
  // }

  // @Public()
  // @Post('reset-password')
  // @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { ttl: 60000, limit: 3 } })
  // @ApiOperation({
  //   summary: 'Reset Password',
  //   description: 'Resets password using verification token obtained from verify-otp endpoint.',
  // })
  // @ApiStandardResponse({
  //   status: 200,
  //   description: 'Password reset successfully',
  //   type: AuthResponseDto,
  // })
  // @ApiBadRequestResponse({ description: 'Invalid verification token or password' })
  // @ResponseMessage(RESPONSE_MESSAGES.AUTH.PASSWORD_RESET)
  // async resetPassword(@Body() dto: ResetPasswordDto) {
  //   return this.authService.resetPassword(dto);
  // }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'User Login (OTP-based)',
    description:
      'Authenticates a user by verifying OTP. First send OTP via the send-otp API with LOGIN_VERIFICATION purpose, then call this endpoint with identifier (email/phone) + OTP to receive auth tokens.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.LOGIN_SUCCESS)
  async login(@Body() dto: UserLoginDto, @Req() req: Request) {
    const deviceInfo = this.extractDeviceInfo(req);
    if (dto.fcmToken) {
      deviceInfo.fcmToken = dto.fcmToken;
    }
    if (dto.rememberMe !== undefined) {
      deviceInfo.rememberMe = dto.rememberMe;
    }
    return this.authService.userLogin(dto, deviceInfo);
  }

  // @Post('change-password')
  // @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { ttl: 60000, limit: 3 } })
  // @ApiOperation({
  //   summary: 'Change Password',
  //   description: 'Allows authenticated users to change their password.',
  // })
  // @ApiStandardResponse({
  //   status: 200,
  //   description: 'Password changed successfully',
  //   type: AuthResponseDto,
  // })
  // @ApiBadRequestResponse({ description: 'Invalid old password or new password same as old' })
  // @ResponseMessage(RESPONSE_MESSAGES.AUTH.PASSWORD_CHANGED)
  // async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
  //   return this.authService.changePassword(user.userId, dto);
  // }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token.',
  })
  @ApiBearerAuth()
  @ApiStandardResponse({
    status: 200,
    description: 'Tokens successfully refreshed',
    type: TokensDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.TOKEN_REFRESHED)
  async refreshTokens(@Req() req: Request) {
    const user = req.user as {
      userId: string;
      deviceId: string;
      refreshToken: string;
    };
    return this.authService.refreshTokens(user.userId, user.deviceId, user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout current device',
    description: 'Invalidates the refresh token for the current device session.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Successfully logged out',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.LOGOUT_SUCCESS)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.userId, user.deviceId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Invalidates all sessions for the user.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Successfully logged out from all devices',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.LOGOUT_ALL_SUCCESS)
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.userId, user.deviceId, true);
  }

  @Post('logout-other-devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout from other devices',
    description: 'Invalidates all sessions except the current one.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Successfully logged out from other devices',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.LOGOUT_OTHERS_SUCCESS)
  async logoutOtherDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.userId, user.deviceId, false);
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Get active sessions',
    description: 'Retrieves a list of all active sessions for the user.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'List of active sessions',
    type: SessionDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.SESSIONS_FETCHED)
  async getActiveSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getActiveSessions(user.userId, user.deviceId);
  }

  @Delete('sessions/:deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke specific session',
    description: 'Invalidates a specific session by device ID.',
  })
  @ApiStandardResponse({ status: 200, description: 'Session revoked', type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Cannot revoke current session' })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.SESSION_REVOKED)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId') targetDeviceId: string,
  ) {
    return this.authService.revokeSession(user.userId, targetDeviceId, user.deviceId);
  }

  private extractDeviceInfo(req: Request): DeviceInfo {
    const userAgent = req.get('user-agent') || 'Unknown';
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'Unknown';

    return {
      deviceName: this.parseDeviceName(userAgent),
      deviceType: this.parseDeviceType(userAgent),
      ipAddress,
      userAgent,
      location: '',
    };
  }

  private parseDeviceName(userAgent: string): string {
    if (userAgent.includes('Chrome')) {
      if (userAgent.includes('Edg')) return 'Microsoft Edge';
      return 'Google Chrome';
    }
    if (userAgent.includes('Firefox')) return 'Mozilla Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return 'Safari';
    }
    if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
      return 'Internet Explorer';
    }
    return 'Unknown Browser';
  }

  private parseDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    return 'desktop';
  }
}
