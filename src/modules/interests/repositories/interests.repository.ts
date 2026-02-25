import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Interests, InterestsDocument } from '../schemas/interests.schema';
import { buildPaginationMeta, PaginationResponse } from '../../../common/types/api-response.type';
import { BasePaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class InterestsRepository extends BaseRepository<InterestsDocument> {
  constructor(
    @InjectModel(Interests.name)
    private readonly interestsModel: Model<InterestsDocument>,
  ) {
    super(interestsModel);
  }

  async findPaginated(
    query: BasePaginationDto,
    additionalFilters: Record<string, any> = {},
  ): Promise<PaginationResponse<InterestsDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortField = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const filter: Record<string, any> = { ...additionalFilters };

    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 } as Record<string, 1 | -1>;

    const [docs, totalDocs] = await Promise.all([
      this.interestsModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.interestsModel.countDocuments(filter),
    ]);

    return {
      meta: buildPaginationMeta(totalDocs, page, limit),
      docs: docs as InterestsDocument[],
    };
  }
}
