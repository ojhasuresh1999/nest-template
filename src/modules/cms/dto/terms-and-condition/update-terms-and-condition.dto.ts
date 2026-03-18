import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateTermsAndConditionCmsDto {
  @ApiProperty({ description: 'Content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
