import { PartialType } from '@nestjs/swagger';
import { CreateInterestsDto } from './create-interests.dto';

export class UpdateInterestsDto extends PartialType(CreateInterestsDto) {}
