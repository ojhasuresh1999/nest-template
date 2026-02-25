import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

/**
 * DTO for User Login — identifier (email/phone) + OTP
 *
 * OTP is sent via the `send-otp` API first with purpose LOGIN_VERIFICATION.
 * Then this login endpoint verifies the OTP and returns auth tokens.
 */
export class UserLoginDto {
  @ApiProperty({
    example: 'suresh.webskitters@gmail.com or +919876543210',
    description: 'Email address or phone number (provide either)',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  identifier: string;

  @ApiProperty({
    example: '1234',
    description: 'OTP received via the send-otp API',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 4, { message: 'OTP must be exactly 4 digits' })
  otp: string;

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
