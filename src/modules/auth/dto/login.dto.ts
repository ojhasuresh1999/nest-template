import { IsEmail, IsNotEmpty, IsString, IsOptional, ValidateIf, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'suresh.webskitters@gmail.com',
    description: 'User email',
    required: false,
  })
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiProperty({ example: '1234567890', description: 'User phone number', required: false })
  @ValidateIf((o) => !o.email && !o.verificationToken)
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @ApiProperty({
    example: 'eyJ...',
    description: 'Verification token for phone or email login',
    required: false,
  })
  @ValidateIf((o) => !!o.phone || !!o.email)
  @IsString()
  @IsOptional()
  verificationToken?: string;

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
