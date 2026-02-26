import { OmitType } from '@nestjs/swagger';
import { BasePaginationDto } from 'src/common/dto/pagination.dto';

export class UserListInterestsDto extends OmitType(BasePaginationDto, [
  'status',
  'sortField',
  'sortOrder',
]) {}

export class AdminListInterestDto extends BasePaginationDto {}
