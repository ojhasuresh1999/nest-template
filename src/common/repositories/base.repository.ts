import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  Document,
  Model,
  PipelineStage,
  ProjectionType,
  QueryOptions,
  Types,
  UpdateQuery,
  QueryFilter,
  ClientSession,
} from 'mongoose';

export abstract class BaseRepository<T extends Document> implements OnApplicationBootstrap {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly model: Model<T>) {}

  /**
   * Automatically triggered by NestJS once the application has fully started.
   * We use it here to synchronize MongoDB indexes safely in the background.
   */
  async onApplicationBootstrap() {
    await this.syncIndexes();
  }

  protected async syncIndexes() {
    try {
      this.logger.debug(`Synchronizing indexes for ${this.model.modelName}...`);
      await this.model.syncIndexes();
      this.logger.verbose(`✅ Synced indexes for ${this.model.modelName}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync indexes for ${this.model.modelName}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

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

  // --- Advanced & Production-Level Methods ---

  /**
   * Quickly check if a document exists without returning the entire document.
   */
  async exists(filter: QueryFilter<T>): Promise<boolean> {
    const result = await this.model.exists(filter).exec();
    return !!result;
  }

  /**
   * Updates a document if it matches the filter, otherwise creates a new one.
   */
  async upsert(filter: QueryFilter<T>, doc: Partial<T>): Promise<T | null> {
    return this.model
      .findOneAndUpdate(filter, doc as UpdateQuery<T>, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  /**
   * Perform multiple write operations in bulk for maximum performance.
   * Useful for data import/migration tasks.
   */
  async bulkWrite(operations: any[], options?: any): Promise<any> {
    return this.model.bulkWrite(operations, options);
  }

  /**
   * Paginates results based on simple filter, limit, and page.
   */
  async paginate(
    filter: QueryFilter<T> = {},
    options: {
      page?: number;
      limit?: number;
      sort?: any;
      projection?: ProjectionType<T>;
    } = {},
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 10);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model.find(filter, options.projection).sort(options.sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Wraps operations in a MongoDB transaction for ACID guarantees.
   * Note: This requires a MongoDB replica set.
   */
  async withTransaction<R>(fn: (session: ClientSession) => Promise<R>): Promise<R> {
    const session = await this.model.db.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
