import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInterestsDto {
  @ApiProperty({ description: 'Interests title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Interests icon' })
  @IsString()
  @IsNotEmpty()
  icon: string;
}
