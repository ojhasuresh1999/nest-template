import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({
    description:
      'Short-lived verification token obtained from POST /auth/verify-otp with purpose ACCOUNT_DELETE_VERIFICATION',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  verificationToken: string;

  @ApiPropertyOptional({
    description: 'Optional reason for deleting the account',
    example: 'No longer need the service',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  reason?: string;
}
