import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { UserRole } from 'src/common/enums';

/**
 * DTO for User Registration — identifier (email/phone) + OTP
 *
 * OTP is sent via the `send-otp` API first with purpose REGISTRATION.
 * Then this register endpoint verifies the OTP, creates the user,
 * and returns auth tokens (auto-login).
 */
export class RegisterDto {
  @ApiProperty({
    example: 'john@example.com or +919876543210',
    description: 'Email address or Phone number the OTP was sent to',
  })
  @IsString()
  @Transform(({ value }) => {
    return value?.trim()?.toLowerCase();
  })
  identifier: string;

  @ApiProperty({
    example: '1234',
    description: '4-digit OTP code',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Length(4, 4, { message: 'OTP must be exactly 4 digits' })
  otp: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description: 'User role for registration',
  })
  @IsEnum(UserRole, { message: 'Invalid user role' })
  role: UserRole;

  @ApiProperty({
    example: 'fcm_token_123',
    description: 'Firebase Cloud Messaging token for push notifications',
    required: false,
  })
  @IsString()
  @IsOptional()
  fcmToken?: string;

  @ApiProperty({
    example: true,
    description: 'Keep user logged in for extended period (30 days vs 1 day)',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
