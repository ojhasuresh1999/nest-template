import {
  Document,
  Model,
  PipelineStage,
  ProjectionType,
  QueryOptions,
  Types,
  UpdateQuery,
  QueryFilter,
} from 'mongoose';

export abstract class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async create(doc: Partial<T>): Promise<T> {
    const createdEntity = new this.model(doc);
    return await createdEntity.save();
  }

  async findOne(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    return this.model.findOne(filter, projection, options).exec();
  }

  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T | null> {
    return this.model.findById(id, projection, options).exec();
  }

  async findAll(
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    return this.model.find(filter, projection, options).exec();
  }

  async update(
    filter: QueryFilter<T>,
    updateDto: UpdateQuery<T>,
    options: QueryOptions<T> = { returnDocument: 'after' },
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(filter, updateDto, options).exec();
  }

  async updateById(
    id: string | Types.ObjectId,
    updateDto: UpdateQuery<T>,
    options: QueryOptions<T> = { returnDocument: 'after' },
  ): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, updateDto, options).exec();
  }

  async delete(filter: QueryFilter<T>): Promise<boolean> {
    const result = await this.model.deleteOne(filter).exec();
    return result.deletedCount === 1;
  }

  async deleteById(id: string | Types.ObjectId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return !!result;
  }

  async aggregate(pipeline: PipelineStage[]): Promise<any[]> {
    return this.model.aggregate(pipeline).exec();
  }

  async count(filter: QueryFilter<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async distinct(field: string, filter: QueryFilter<T> = {}): Promise<any[]> {
    return this.model.distinct(field, filter).exec();
  }
}
