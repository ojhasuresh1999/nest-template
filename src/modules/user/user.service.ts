import { Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { StatusChangeDto } from 'src/common/dto/pagination.dto';
import { ApiError } from 'src/common/errors/api-error';
import { AdminListUsersDto } from './dto/admin-list-users.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRepository } from './repositories/user.repository';
import { UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(filter: any): Promise<UserDocument[]> {
    return this.userRepository.findAll(filter);
  }

  async findOne(idOrSlug: string, filter: any = {}): Promise<UserDocument | null> {
    if (isValidObjectId(idOrSlug)) {
      return this.userRepository.findOne({ _id: idOrSlug, ...filter });
    }
    return this.userRepository.findOne({ slug: idOrSlug, ...filter });
  }

  async getMyProfile(currentUserId: string) {
    const userProfile = await this.userRepository.findOne({ _id: currentUserId });

    if (!userProfile) {
      throw new NotFoundException('Your profile could not be found');
    }

    return userProfile;
  }

  async updateMyProfile(currentUserId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findById(currentUserId);
    if (!user) {
      throw new NotFoundException('Your profile could not be found');
    }

    const updated = await this.userRepository.updateById(currentUserId, dto);
    if (!updated) {
      throw new NotFoundException('Profile update failed');
    }

    return updated;
  }

  async viewPublicProfile(userId: string) {
    if (!isValidObjectId(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const userProfile = await this.userRepository.findFullProfile({ userId });

    if (!userProfile) {
      throw new NotFoundException('The requested profile does not exist');
    }

    return userProfile;
  }

  async getUserProfileBySlug(slug: string) {
    const userProfile = await this.userRepository.findFullProfile({ slug: slug });

    if (!userProfile) {
      throw new NotFoundException('The requested profile does not exist');
    }

    return userProfile;
  }

  async adminListUsers(query: AdminListUsersDto) {
    return this.userRepository.findPaginatedUsers(query);
  }

  async adminGetUser(userId: string) {
    if (!isValidObjectId(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const user = await this.userRepository.getUserProfileByAdmin(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async adminUpdateStatus(userId: string, { status }: StatusChangeDto) {
    if (!isValidObjectId(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.userRepository.updateById(userId, { status });
    if (!updated) {
      throw new NotFoundException('User not found during status update');
    }

    return updated;
  }

  async adminUpdateUser(userId: string, dto: AdminUpdateUserDto) {
    if (!isValidObjectId(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        email: dto.email,
        _id: { $ne: userId },
      });
      if (existingEmail) {
        throw ApiError.badRequest('Email is already in use by another account');
      }
    }

    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await this.userRepository.findOne({
        phone: dto.phone,
        _id: { $ne: userId },
      });
      if (existingPhone) {
        throw ApiError.badRequest('Phone number is already in use by another account');
      }
    }

    const updated = await this.userRepository.updateById(userId, dto);
    if (!updated) {
      throw new NotFoundException('User not found during update');
    }

    return updated;
  }

  async adminSoftDeleteUser(userId: string) {
    if (!isValidObjectId(userId)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const deleted = await this.userRepository.updateById(userId, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    if (!deleted) {
      throw new NotFoundException('User not found during deletion');
    }

    return { message: 'User deleted successfully' };
  }

  async adminGetStats() {
    return this.userRepository.getUserStats();
  }
}
