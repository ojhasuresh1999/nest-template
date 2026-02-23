import { HydratedDocument } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { Permission, StatusEnum } from '../../../common/enums';
import { SchemaFactory } from '@nestjs/mongoose';

@SchemaWith({ collection: 'roles' })
export class Role {
  @PropData({ required: true })
  name: string;

  @PropData({
    type: [String],
    enum: Permission,
    default: [],
  })
  permissions: Permission[];

  @PropData({ type: String, default: '', required: false })
  description: string;

  @PropData({ type: String, default: StatusEnum.ACTIVE })
  status: string;

  @PropData({ type: Boolean, default: false })
  isStatic: boolean; // System roles (Super Admin, etc.) cannot be deleted
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ name: 1 }, { unique: true });
RoleSchema.index({ status: 1 });

export type RoleDocument = HydratedDocument<Role>;
