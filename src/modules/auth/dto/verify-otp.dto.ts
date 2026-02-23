import { IsEnum, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { OtpPurpose } from '../types/otp.types';

/**
 * DTO for verifying OTP
 */
export class VerifyOtpDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Email address or Phone number the OTP was sent to',
  })
  @IsString()
  @Transform(({ value }) => {
    return value?.toLowerCase();
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
    enum: OtpPurpose,
    example: OtpPurpose.REGISTRATION,
    description: 'Purpose of the OTP verification',
  })
  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
