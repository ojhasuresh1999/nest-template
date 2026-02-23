import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ApiStandardResponse } from 'src/common/decorators/api-standard-response.decorator';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AdminLoginDto, AuthResponseDto, TokensDto, SessionDto, ChangePasswordDto } from './dto';
import { JwtAuthGuard, JwtRefreshGuard, RolesGuard } from './guards';
import { Public, CurrentUser, Roles } from './decorators';
import type { AuthenticatedUser } from './decorators';
import { DeviceInfo } from './services/device-session.service';
import { UserRole } from 'src/common/enums';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { RESPONSE_MESSAGES } from 'src/common/constants/response-messages.constant';

@ApiTags('Auth')
@Controller({ path: 'admin/auth', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AuthAdminController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Admin Login',
    description:
      'Authenticates an admin user with Email + Password. Only users with Admin or SuperAdmin role can login.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'Access denied — not an admin account' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.LOGIN_SUCCESS)
  async login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const deviceInfo = this.extractDeviceInfo(req);
    if (dto.fcmToken) {
      deviceInfo.fcmToken = dto.fcmToken;
    }
    if (dto.rememberMe !== undefined) {
      deviceInfo.rememberMe = dto.rememberMe;
    }
    return this.authService.adminLogin(dto, deviceInfo);
  }

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

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: 'Change Password',
    description: 'Allows authenticated admins to change their password.',
  })
  @ApiStandardResponse({
    status: 200,
    description: 'Password changed successfully',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid old password or new password same as old' })
  @ResponseMessage(RESPONSE_MESSAGES.AUTH.PASSWORD_CHANGED)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
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
    description: 'Invalidates all sessions for the admin.',
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
    description: 'Retrieves a list of all active sessions for the admin.',
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

  @Get('check')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin check endpoint',
    description: 'Verifies if the user has admin or super admin privileges.',
  })
  @ApiStandardResponse({ status: 200, description: 'Admin access verified', type: AuthResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden - Insufficient permissions' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ResponseMessage(RESPONSE_MESSAGES.ADMIN.ACCESS_VERIFIED)
  adminCheck(@CurrentUser() user: AuthenticatedUser) {
    return {
      message: 'Admin access verified',
      role: user.role,
    };
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
