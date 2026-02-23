import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StatusEnum } from 'src/common/enums';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { DeviceSession } from '../../auth/schemas/device-session.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UserRepository extends BaseRepository<UserDocument> {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @InjectModel(User.name) userModel: Model<UserDocument>,
    @InjectModel(DeviceSession.name)
    private deviceSessionModel: Model<DeviceSession>,
  ) {
    super(userModel);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email });
  }

  async findDeviceTokens(userIds: string[]): Promise<string[]> {
    const userObjectIds = userIds.map((id) => new Types.ObjectId(id));

    this.logger.debug(`Finding device tokens for users: ${userIds.join(', ')}`);

    const sessions = await this.deviceSessionModel
      .find({
        userId: { $in: userObjectIds },
        isActive: true,
        fcmToken: { $exists: true, $nin: [null, ''] },
      })
      .select('fcmToken userId')
      .lean();

    this.logger.debug(`Found ${sessions.length} active sessions with FCM tokens`);

    const tokens = sessions
      .map((session) => session.fcmToken)
      .filter((token): token is string => !!token && token.length > 0);

    this.logger.debug(`Valid FCM tokens found: ${tokens.length}`);

    return tokens;
  }

  async findBySlug(slug: string): Promise<UserDocument | null> {
    return this.findOne({ slug }, '_id firstName lastName profileImage');
  }

  async findFullProfile(searchCriteria: { userId?: string; slug?: string }) {
    const profileFilter: any = {
      isDeleted: false,
      status: StatusEnum.ACTIVE,
    };

    if (searchCriteria.userId) {
      profileFilter._id = new Types.ObjectId(searchCriteria.userId);
    } else if (searchCriteria.slug) {
      profileFilter.slug = searchCriteria.slug;
    }

    const result = await this.aggregate([
      { $match: profileFilter },
      {
        $lookup: {
          from: 'user_details',
          localField: '_id',
          foreignField: 'user',
          as: 'details',
        },
      },
      { $unwind: { path: '$details', preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          'details.firstName': '$firstName',
          'details.lastName': '$lastName',
          'details.fullName': '$fullName',
          'details.email': '$email',
          'details.phone': '$phone',
          'details.profileImage': '$profileImage',
          'details.slug': '$slug',
        },
      },
      {
        $project: {
          password: 0,
          __v: 0,
          'details.__v': 0,
        },
      },
    ]);

    if (result.length > 0) {
      return result[0];
    }

    return null;
  }

  async getUserProfileByAdmin(userId: string) {
    const profileFilter: any = {
      _id: new Types.ObjectId(userId),
      isDeleted: false,
    };

    const result = await this.aggregate([
      { $match: profileFilter },
      {
        $lookup: {
          from: 'user_details',
          localField: '_id',
          foreignField: 'user',
          as: 'details',
        },
      },
      { $unwind: { path: '$details', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          password: 0,
          __v: 0,
          'details.__v': 0,
        },
      },
    ]);

    if (result.length > 0) {
      return result[0];
    }

    return null;
  }
}
