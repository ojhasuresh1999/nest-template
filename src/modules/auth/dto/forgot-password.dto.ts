import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for Forgot Password — supports both email and phone
 */
export class ForgotPasswordDto {
  @ApiProperty({
    example: 'john@example.com or +919876543210',
    description: 'Email address or phone number',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  identifier: string;
}
