import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import {
  SuspiciousActivity,
  SuspiciousActivityDocument,
} from '../schemas/suspicious-activity.schema';

@Injectable()
export class SuspiciousActivityRepository extends BaseRepository<SuspiciousActivityDocument> {
  constructor(
    @InjectModel(SuspiciousActivity.name)
    suspiciousActivityModel: Model<SuspiciousActivityDocument>,
  ) {
    super(suspiciousActivityModel);
  }
}
