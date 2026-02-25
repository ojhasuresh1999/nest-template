import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO for Admin Login — Email + Password only
 */
export class AdminLoginDto {
  @ApiProperty({
    example: 'superadmin@yopmail.com',
    description: 'Admin email address',
  })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase())
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Admin password',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

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
