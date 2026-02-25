import { ApiProperty } from '@nestjs/swagger';
import { StatusEnum } from 'src/common/enums';

export class InterestsResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  icon: string;

  @ApiProperty({ enum: StatusEnum })
  status: StatusEnum;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
