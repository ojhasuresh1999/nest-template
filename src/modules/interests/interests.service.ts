import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiError } from 'src/common/errors/api-error';
import { CreateInterestsDto } from './dto/create-interests.dto';
import { InterestsRepository } from './repositories/interests.repository';
import { InterestsDocument } from './schemas/interests.schema';
import { BasePaginationDto, StatusChangeDto } from 'src/common/dto/pagination.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { StatusEnum } from 'src/common/enums';

@Injectable()
export class InterestsService {
  constructor(private readonly interestsRepository: InterestsRepository) {}

  async findAll(query: BasePaginationDto, isAdmin = false) {
    const additionalFilters: Record<string, any> = {};
    if (!isAdmin) {
      additionalFilters.status = StatusEnum.ACTIVE;
    }
    return await this.interestsRepository.findPaginated(query, additionalFilters);
  }

  async create(createInterestsDto: CreateInterestsDto): Promise<InterestsDocument> {
    const isExist = await this.interestsRepository.findOne({ title: createInterestsDto.title });
    if (isExist) ApiError.badRequest('Interest already exists');
    return await this.interestsRepository.create(createInterestsDto);
  }

  async findOne(id: string): Promise<InterestsDocument> {
    const doc = await this.interestsRepository.findById(id);
    if (!doc) throw new NotFoundException('Interest not found');
    return doc;
  }

  async update(id: string, updateInterestsDto: UpdateInterestsDto): Promise<InterestsDocument> {
    const doc = await this.findOne(id);
    if (updateInterestsDto.title && updateInterestsDto.title !== doc.title) {
      const isExist = await this.interestsRepository.findOne({ title: updateInterestsDto.title });
      if (isExist) ApiError.badRequest('Interest already exists');
    }
    const updated = await this.interestsRepository.updateById(id, updateInterestsDto);
    if (!updated) throw new NotFoundException('Interest not found during update');
    return updated;
  }

  async updateStatus(id: string, { status }: StatusChangeDto): Promise<InterestsDocument> {
    await this.findOne(id);
    const updated = await this.interestsRepository.updateById(id, { status });
    if (!updated) throw new NotFoundException('Interest not found during status update');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.findOne(id);
    return await this.interestsRepository.deleteById(id);
  }
}
