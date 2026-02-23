import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Permission } from '../../../common/enums';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: Permission, isArray: true })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];

  @ApiProperty({ example: 'Administrator role with full access', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  isStatic?: boolean;
}
