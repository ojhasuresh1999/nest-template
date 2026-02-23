import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  // @ApiProperty({ example: '1234567890', description: 'User phone number' })
  // @IsString()
  // @IsNotEmpty()
  // phone: string;

  @ApiProperty({ example: 'eyJ...', description: 'Verification Token from verify-otp' })
  @IsString()
  @IsNotEmpty()
  verificationToken: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'New Password',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
}
