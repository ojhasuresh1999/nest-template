import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Cms, CmsDocument } from '../schemas/cms.schema';

@Injectable()
export class CmsRepository extends BaseRepository<CmsDocument> {
  constructor(
    @InjectModel(Cms.name)
    private readonly cmsModel: Model<CmsDocument>,
  ) {
    super(cmsModel);
  }

  async findCmsByType(type: string): Promise<CmsDocument | null> {
    return this.cmsModel.findOne({ type });
  }

  async upsertCmsByType(type: string, data: object): Promise<CmsDocument | null> {
    return this.cmsModel.findOneAndUpdate({ type }, { data }, { new: true, upsert: true });
  }
}
