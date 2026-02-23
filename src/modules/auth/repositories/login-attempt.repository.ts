import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { LoginAttempt, LoginAttemptDocument } from '../schemas/login-attempt.schema';

@Injectable()
export class LoginAttemptRepository extends BaseRepository<LoginAttemptDocument> {
  constructor(
    @InjectModel(LoginAttempt.name)
    loginAttemptModel: Model<LoginAttemptDocument>,
  ) {
    super(loginAttemptModel);
  }

  async findByIdentifierAndIp(
    identifier: string,
    ipAddress: string,
  ): Promise<LoginAttemptDocument | null> {
    return this.findOne({ identifier, ipAddress });
  }
}
