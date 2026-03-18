import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BasePaginationDto } from 'src/common/dto/pagination.dto';

export class AdminListUsersDto extends BasePaginationDto {
  @ApiPropertyOptional({ description: 'Filter by role name (e.g. User, Expert, Admin)' })
  @IsOptional()
  @IsString()
  role?: string;
}
