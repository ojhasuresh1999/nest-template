import { SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PropData, SchemaWith } from '../../../common/decorators/schema.decorator';
import { SocialPlatformEnum, StatusEnum } from 'src/common/enums';
import { softDeletePlugin } from '../../../common/plugins/soft-delete.plugin';
import { User } from './user.schema';

class RatingStats {
  @PropData({ default: 0 })
  average: number;

  @PropData({ default: 0 })
  totalReviews: number;
}

class SocialLink {
  @PropData({ required: true, enum: SocialPlatformEnum })
  platform: SocialPlatformEnum;

  @PropData({ required: true })
  url: string;
}

@SchemaWith({ collection: 'userDetails' })
export class UserDetails {
  @PropData({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user: Types.ObjectId;

  //video
  @PropData({ type: String, default: '' })
  videoUrl: string;

  @PropData({
    type: [String],
    default: [],
    index: true,
  })
  languages: string[];

  @PropData({
    type: [String],
    default: [],
    index: true,
  })
  experience: string[];

  @PropData({ required: true })
  headline: string;

  @PropData({ required: true })
  about: string;

  @PropData({
    type: [String],
    default: [],
    index: true,
  })
  areasOfGuidance: string[];

  @PropData({ type: String, default: '' })
  description: string;

  @PropData({ type: RatingStats, default: () => ({}) })
  rating: RatingStats;

  @PropData({
    type: [String],
    default: [],
  })
  sessionBenefits: string[];

  @PropData({
    type: [SocialLink],
    default: [],
  })
  socialLinks: SocialLink[];

  @PropData({ default: StatusEnum.ACTIVE, index: true })
  status: StatusEnum;
}

export const UserDetailsSchema = SchemaFactory.createForClass(UserDetails);

UserDetailsSchema.plugin(softDeletePlugin, { deletedByField: 'deletedBy' });

export type UserDetailsDocument = HydratedDocument<UserDetails>;

UserDetailsSchema.pre('save', async function () {
  const userDetails = this as unknown as UserDetailsDocument;
  if (userDetails.isModified('areasOfGuidance')) {
    userDetails.areasOfGuidance = userDetails.areasOfGuidance.map((area) => area.trim());
  }
  if (userDetails.isModified('sessionBenefits')) {
    userDetails.sessionBenefits = userDetails.sessionBenefits.map((benefit) => benefit.trim());
  }
  if (userDetails.isModified('socialLinks')) {
    userDetails.socialLinks = userDetails.socialLinks.map((link) => ({
      platform: link.platform,
      url: link.url.trim(),
    }));
  }
});

UserDetailsSchema.index({ status: 1, isDeleted: 1 });
UserDetailsSchema.index({ createdAt: -1 });
UserDetailsSchema.index(
  { user: 1, isDeleted: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  },
);
UserDetailsSchema.index({ 'rating.average': -1 });
