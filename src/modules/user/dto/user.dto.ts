import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { StatusEnum } from 'src/common/enums';

export class StatusUserDto {
  @ApiProperty({ description: 'Status', required: true, enum: StatusEnum })
  @IsEnum(StatusEnum, { message: 'Status must be either Active or Inactive' })
  @IsNotEmpty({ message: 'Status is required' })
  status: string;
}
