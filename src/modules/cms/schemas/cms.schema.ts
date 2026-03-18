import { SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { CmsType } from 'src/common/enums';

@SchemaWith({ collection: 'cms' })
export class Cms {
  @PropData({ required: true, type: Object })
  data: object;

  @PropData({ index: true, type: String, enum: CmsType })
  type: string;

  @PropData({ type: Date, default: Date.now })
  createdAt: Date;

  @PropData({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const CmsSchema = SchemaFactory.createForClass(Cms);

export type CmsDocument = HydratedDocument<Cms>;
