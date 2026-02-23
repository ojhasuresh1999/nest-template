import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================================
// Email Job DTOs
// ============================================================================

/**
 * DTO for sending a single email
 */
export class SendEmailDto {
  @ApiProperty({ description: 'Email recipient(s)', example: 'user@example.com' })
  @IsString({ each: true })
  to: string | string[];

  @ApiProperty({ description: 'Email subject', example: 'Welcome to our platform' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Template name to use', example: 'welcome' })
  @IsString()
  templateName: string;

  @ApiPropertyOptional({ description: 'Template variables' })
  @IsOptional()
  locals?: Record<string, unknown>;
}

/**
 * DTO for sending bulk emails
 */
export class SendBulkEmailDto {
  @ApiProperty({ description: 'Array of email recipients with their data', type: [SendEmailDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendEmailDto)
  recipients: SendEmailDto[];
}

/**
 * DTO for sending welcome email
 */
export class SendWelcomeEmailDto {
  @ApiProperty({ description: 'Recipient email', example: 'user@example.com' })
  @IsString()
  to: string;

  @ApiProperty({ description: 'User name for personalization', example: 'John Doe' })
  @IsString()
  userName: string;

  @ApiPropertyOptional({ description: 'Email verification link' })
  @IsOptional()
  @IsString()
  verificationLink?: string;
}

/**
 * DTO for sending password reset email
 */
export class SendPasswordResetDto {
  @ApiProperty({ description: 'Recipient email', example: 'user@example.com' })
  @IsString()
  to: string;

  @ApiProperty({ description: 'User name for personalization', example: 'John Doe' })
  @IsString()
  userName: string;

  @ApiProperty({
    description: 'Password reset link',
    example: 'https://example.com/reset?token=xyz',
  })
  @IsString()
  resetLink: string;

  @ApiProperty({ description: 'Expiration time description', example: '1 hour' })
  @IsString()
  expiresIn: string;
}

/**
 * DTO for sending email verification
 */
export class SendEmailVerificationDto {
  @ApiProperty({ description: 'Recipient email', example: 'user@example.com' })
  @IsString()
  to: string;

  @ApiProperty({ description: 'User name for personalization', example: 'John Doe' })
  @IsString()
  userName: string;

  @ApiProperty({ description: 'Email verification link' })
  @IsString()
  verificationLink: string;

  @ApiProperty({ description: 'Expiration time description', example: '24 hours' })
  @IsString()
  expiresIn: string;
}

/**
 * DTO for sending OTP email
 */
export class SendOtpEmailDto {
  @ApiProperty({ description: 'Recipient email', example: 'user@example.com' })
  @IsString()
  to: string;

  @ApiProperty({ description: 'OTP code', example: '1234' })
  @IsString()
  otp: string;

  @ApiProperty({ description: 'Purpose of the OTP', example: 'Account Registration' })
  @IsString()
  purpose: string;

  @ApiProperty({ description: 'User name for personalization', example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'OTP validity in minutes', example: 5 })
  @IsNumber()
  @Min(1)
  expiresInMinutes: number;
}

// ============================================================================
// SMS Job DTOs
// ============================================================================

/**
 * DTO for sending a single SMS
 */
export class SendSmsDto {
  @ApiProperty({ description: 'Phone number with country code', example: '+919876543210' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'SMS message content', example: 'Your verification code is 123456' })
  @IsString()
  message: string;
}

/**
 * DTO for sending OTP via SMS
 */
export class SendOtpDto {
  @ApiProperty({ description: 'Phone number with country code', example: '+919876543210' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'OTP code', example: 123456 })
  @IsNumber()
  code: number;

  @ApiProperty({ description: 'OTP validity in minutes', example: 5 })
  @IsNumber()
  @Min(1)
  expiresInMinutes: number;
}

// ============================================================================
// Notification Job DTOs
// ============================================================================

/**
 * DTO for sending push notification
 */
export class SendPushDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Notification title', example: 'New Match Found!' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body', example: 'You have a new match. Check it out!' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Additional data payload' })
  @IsOptional()
  data?: Record<string, unknown>;
}

/**
 * DTO for sending in-app notification
 */
export class SendInAppDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Notification type', example: 'match' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Notification message', example: 'You have a new match!' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
