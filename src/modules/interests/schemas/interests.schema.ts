import { SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { StatusEnum } from 'src/common/enums';
import { softDeletePlugin } from '../../../common/plugins/soft-delete.plugin';

@SchemaWith({ collection: 'interests' })
export class Interests {
  @PropData({ required: true, index: true })
  title: string;

  @PropData({ required: true })
  icon: string;

  @PropData({ default: StatusEnum.ACTIVE })
  status: StatusEnum;
}

export const InterestsSchema = SchemaFactory.createForClass(Interests);

InterestsSchema.plugin(softDeletePlugin);

export type InterestsDocument = HydratedDocument<Interests>;
