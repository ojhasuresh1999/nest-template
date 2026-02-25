import { Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
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

  async getUserProfileBySlug(slug: string) {
    const userProfile = await this.userRepository.findFullProfile({ slug: slug });

    if (!userProfile) {
      throw new NotFoundException('The requested profile does not exist');
    }

    return userProfile;
  }
}
