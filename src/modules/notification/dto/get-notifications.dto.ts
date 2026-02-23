import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { BasePaginationDto } from 'src/common/dto/pagination.dto';

export class GetNotificationsDto extends BasePaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by read status (true = read only, false = unread only)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  isRead?: boolean;
}
