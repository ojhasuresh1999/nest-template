import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { StatusEnum, SortOrderEnum } from '../enums';

export class SortDto {
  @IsOptional()
  @ApiProperty({
    required: false,
    type: 'string',
    enum: ['createdAt', 'updatedAt'],
    default: 'createdAt',
  })
  field: 'createdAt' | 'updatedAt' = 'createdAt';

  @IsOptional()
  @ApiProperty({ required: false, type: 'string', enum: ['asc', 'desc'], default: 'desc' })
  order: 'asc' | 'desc' = 'desc';
}

// ==========================================
// Pagination DTOs
// ==========================================

export class BasePaginationDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number (1-indexed)' })
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : 1))
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Number of items per page' })
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : 10))
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search by name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Status Filter', enum: StatusEnum })
  @IsEnum(StatusEnum, { message: 'Status must be either Active or Inactive' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Sort Field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort Order',
    enum: SortOrderEnum,
    default: SortOrderEnum.DESC,
  })
  @IsEnum(SortOrderEnum, { message: 'Sort order must be either Asc or Desc' })
  @IsOptional()
  sortOrder?: string = SortOrderEnum.DESC;
}

// ==========================================
// Status Change DTO
// ==========================================

export class StatusChangeDto {
  @ApiProperty({ type: 'string', enum: StatusEnum, description: 'New status value' })
  @IsEnum(StatusEnum, { message: 'Status must be either Active or Inactive' })
  status: string;
}
