import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { SystemLog, SystemLogDocument } from '../schemas/system-log.schema';

@Injectable()
export class SystemLogRepository extends BaseRepository<SystemLogDocument> {
  constructor(
    @InjectModel(SystemLog.name)
    private readonly systemLogModel: Model<SystemLogDocument>,
  ) {
    super(systemLogModel);
  }

  async insertBatch(logs: Partial<SystemLog>[]): Promise<number> {
    const result = await this.systemLogModel.insertMany(logs, { ordered: false });
    return result.length;
  }
}
