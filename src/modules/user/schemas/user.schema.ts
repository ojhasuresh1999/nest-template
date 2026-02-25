import { SchemaFactory } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import mongoose, { HydratedDocument } from 'mongoose';
import { Role } from 'src/modules/role/schemas/role.schema';
import { synchronizeNameFields } from 'src/utils/utils.helper';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { StatusEnum } from '../../../common/enums';
import { autoSlugPlugin } from '../../../common/plugins/auto-slug.plugin';
import { softDeletePlugin } from '../../../common/plugins/soft-delete.plugin';

@SchemaWith({ collection: 'users' })
export class User {
  @PropData({ default: '' })
  firstName: string;

  @PropData({ default: '' })
  lastName: string;

  @PropData({ required: false, default: '' })
  fullName: string;

  @PropData({
    type: String,
    lowercase: true,
    trim: true,
  })
  slug: string;

  @PropData({ required: false, unique: true, sparse: true, index: true })
  email: string;

  @PropData({ required: false, unique: true, sparse: true, index: true })
  phone: string;

  @PropData({ required: false, default: '' })
  password: string;

  @PropData({ type: String, default: '' })
  profileImage?: string;

  @PropData({ type: Boolean, default: false, index: true })
  isEmailVerified: boolean;

  @PropData({ type: Boolean, default: false, index: true })
  isPhoneVerified: boolean;

  @PropData({
    type: mongoose.Schema.Types.ObjectId,
    ref: Role.name,
    required: false,
    index: true,
  })
  role: mongoose.Types.ObjectId;

  @PropData({ type: Boolean, default: false, index: true })
  isDeleted: boolean;

  @PropData({ type: String, default: StatusEnum.ACTIVE, index: true })
  status: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ firstName: 1, lastName: 1 });
UserSchema.index({ slug: 1 }, { unique: true });
UserSchema.index({ status: 1, isDeleted: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ '$**': 'text' });
UserSchema.index(
  { email: 1, isDeleted: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  },
);

UserSchema.index(
  { phone: 1, isDeleted: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  },
);

UserSchema.virtual('initials').get(function (this: UserDocument) {
  const first = this.firstName ? this.firstName.charAt(0).toUpperCase() : '';
  const last = this.lastName ? this.lastName.charAt(0).toUpperCase() : '';
  return `${first}${last}`;
});

UserSchema.methods.comparePassword = async function (this: UserDocument, password: string) {
  return await argon2.verify(this.password, password);
};

UserSchema.methods.hashPassword = async function (this: UserDocument, password: string) {
  return await argon2.hash(password);
};

UserSchema.pre('save', async function () {
  const user = this as unknown as UserDocument;
  synchronizeNameFields(user);

  if (user.isModified('password')) {
    user.password = await argon2.hash(user.password);
  }
});

UserSchema.pre('findOneAndUpdate', async function () {
  let update = this.getUpdate() as Partial<UserDocument>;
  if (!update) return;
  update = synchronizeNameFields(update);
  if (update.password) {
    update.password = await argon2.hash(update.password);
  }
  this.setUpdate(update);
});

UserSchema.plugin(autoSlugPlugin, {
  sourceFields: ['fullName', 'email'],
  sourceStrategy: 'firstFound',
  slugField: 'slug',
  unique: true,
  updateOnChange: true,
});

UserSchema.plugin(softDeletePlugin, { deletedByField: 'deletedBy' });

export type UserDocument = HydratedDocument<User> & {
  comparePassword(password: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
  initials: string;
};
