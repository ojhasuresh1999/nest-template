import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdatePrivacyPolicyCmsDto {
  @ApiProperty({ description: 'Content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
