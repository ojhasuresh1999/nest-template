import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StatusEnum } from 'src/common/enums';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { buildPaginationMeta, PaginationResponse } from '../../../common/types/api-response.type';
import { DeviceSession } from '../../auth/schemas/device-session.schema';
import { AdminListUsersDto } from '../dto/admin-list-users.dto';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UserRepository extends BaseRepository<UserDocument> {
  constructor(
    @InjectModel(User.name) userModel: Model<UserDocument>,
    @InjectModel(DeviceSession.name)
    private deviceSessionModel: Model<DeviceSession>,
  ) {
    super(userModel);
  }

  async findPaginatedUsers(
    query: AdminListUsersDto,
    additionalFilters: Record<string, any> = {},
  ): Promise<PaginationResponse<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      role,
      sortField = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const matchStage: Record<string, any> = { isDeleted: false, ...additionalFilters };

    if (status) {
      matchStage.status = status;
    }

    if (search) {
      matchStage.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'roles',
          localField: 'role',
          foreignField: '_id',
          as: 'roleInfo',
        },
      },
      { $unwind: { path: '$roleInfo', preserveNullAndEmptyArrays: true } },
    ];

    if (role) {
      pipeline.push({
        $match: { 'roleInfo.name': { $regex: `^${role}$`, $options: 'i' } },
      });
    }

    const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    pipeline.push(
      {
        $project: {
          password: 0,
          __v: 0,
          'roleInfo.permissions': 0,
          'roleInfo.__v': 0,
        },
      },
      {
        $facet: {
          docs: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    );

    const [result] = await this.aggregate(pipeline);
    const totalDocs = result.totalCount[0]?.count || 0;

    return {
      meta: buildPaginationMeta(totalDocs, page, limit),
      docs: result.docs,
    };
  }

  async getUserStats(): Promise<{ byRole: any[]; byStatus: any[]; totalUsers: number }> {
    const [byRole, byStatus, totalUsers] = await Promise.all([
      this.aggregate([
        { $match: { isDeleted: false } },
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'roleInfo',
          },
        },
        { $unwind: { path: '$roleInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$roleInfo.name', 'Unassigned'] },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, role: '$_id', count: 1 } },
        { $sort: { count: -1 } },
      ]),
      this.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
        { $sort: { count: -1 } },
      ]),
      this.count({ isDeleted: false }),
    ]);

    return { byRole, byStatus, totalUsers };
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
