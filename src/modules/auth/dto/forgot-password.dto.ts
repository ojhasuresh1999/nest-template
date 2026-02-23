import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: '1234567890', description: 'User phone number' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
