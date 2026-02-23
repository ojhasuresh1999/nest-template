import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OtpPurpose } from '../types/otp.types';

/**
 * DTO for sending OTP — supports both email and phone
 */
export class SendOtpDto {
  @ApiProperty({
    example: 'suresh.webskitters@gmail.com or +919876543210',
    description: 'Email address or phone number to send OTP to',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  identifier: string;

  @ApiProperty({
    enum: OtpPurpose,
    example: OtpPurpose.LOGIN_VERIFICATION,
    description: 'Purpose of the OTP',
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
