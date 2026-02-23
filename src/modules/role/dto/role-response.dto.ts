import { ApiProperty } from '@nestjs/swagger';
import { Permission, StatusEnum } from '../../../common/enums';

export class RoleResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;

  @ApiProperty({ example: 'Admin' })
  name: string;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions: Permission[];

  @ApiProperty({ example: 'Administrator role with full access', required: false })
  description?: string;

  @ApiProperty({ enum: StatusEnum, example: StatusEnum.ACTIVE })
  status: string;

  @ApiProperty({ example: false })
  isStatic: boolean;

  @ApiProperty({ example: '2023-11-20T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-11-20T10:00:00.000Z' })
  updatedAt: Date;
}
