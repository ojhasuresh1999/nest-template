import { Model, PipelineStage, Query, Schema } from 'mongoose';
import { SoftDeleteOptions } from './plugin.types';

const defaultOptions: Required<Omit<SoftDeleteOptions, 'deletedByField'>> & {
  deletedByField?: string;
} = {
  deletedField: 'isDeleted',
  deletedAtField: 'deletedAt',
  deletedByField: undefined,
  indexFields: true,
  overrideMethods: true,
};

type MethodType =
  | 'find'
  | 'findOne'
  | 'findOneAndUpdate'
  | 'findOneAndDelete'
  | 'count'
  | 'countDocuments'
  | 'aggregate'
  | 'updateOne'
  | 'updateMany'
  | 'deleteOne'
  | 'deleteMany';

const overrideableMethods: MethodType[] = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'count',
  'countDocuments',
  'aggregate',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
];

/**
 * Production-level Soft Delete Plugin for Mongoose
 *
 * Features:
 * - Adds isDeleted, deletedAt, and optional deletedBy fields
 * - Overrides query methods to exclude deleted documents by default
 * - Provides softDelete() and restore() instance methods
 * - Provides static methods for bulk operations
 * - Configurable field names and behaviors
 *
 * @example
 * ```typescript
 * import { softDeletePlugin } from 'src/common/plugins';
 *
 * UserSchema.plugin(softDeletePlugin, { indexFields: true });
 *
 * // Instance methods
 * await user.softDelete();
 * await user.restore();
 *
 * // Static methods
 * await UserModel.softDeleteById(userId);
 * await UserModel.findDeleted({ email: 'test@example.com' });
 * await UserModel.findWithDeleted();
 * ```
 */
export function softDeletePlugin(schema: Schema<any>, options: SoftDeleteOptions = {}): void {
  const opts = { ...defaultOptions, ...options };
  const { deletedField, deletedAtField, deletedByField, indexFields, overrideMethods } = opts;

  schema.add({
    [deletedField]: {
      type: Boolean,
      default: false,
      index: indexFields,
    },
  } as Parameters<typeof schema.add>[0]);

  schema.add({
    [deletedAtField]: {
      type: Date,
      default: null,
    },
  } as Parameters<typeof schema.add>[0]);

  if (deletedByField) {
    schema.add({
      [deletedByField]: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    } as Parameters<typeof schema.add>[0]);
  }

  if (indexFields) {
    schema.index({ [deletedField]: 1, createdAt: -1 });
  }
  const methodsToOverride: MethodType[] =
    overrideMethods === true
      ? overrideableMethods
      : Array.isArray(overrideMethods)
        ? (overrideMethods as MethodType[]).filter((m) => overrideableMethods.includes(m))
        : [];

  const shouldIncludeDeleted = (query: Query<unknown, any>): boolean => {
    const options = query.getOptions() as { includeDeleted?: boolean };
    return options.includeDeleted === true;
  };
  if (methodsToOverride.length > 0) {
    const queryMiddleware = async function (this: Query<unknown, any>): Promise<void> {
      if (!shouldIncludeDeleted(this)) {
        const conditions = this.getFilter();
        if (conditions[deletedField] === undefined) {
          this.where({ [deletedField]: { $ne: true } });
        }
      }
    };

    // Apply middleware to each method
    methodsToOverride.forEach((method) => {
      if (
        [
          'find',
          'findOne',
          'findOneAndUpdate',
          'findOneAndDelete',
          'count',
          'countDocuments',
          'updateOne',
          'updateMany',
          'deleteOne',
          'deleteMany',
        ].includes(method)
      ) {
        schema.pre(method as 'find', queryMiddleware as () => void);
      }
    });

    if (methodsToOverride.includes('aggregate')) {
      schema.pre('aggregate', async function (this: any) {
        const pipeline = this.pipeline() as PipelineStage[];
        const hasDeletedMatch = pipeline.some((stage) => {
          if ('$match' in stage) {
            const matchStage = stage.$match as Record<string, unknown>;
            return (
              matchStage[deletedField] !== undefined ||
              (matchStage.$and as Array<Record<string, unknown>>)?.some(
                (c) => c[deletedField] !== undefined,
              )
            );
          }
          return false;
        });

        if (!hasDeletedMatch) {
          pipeline.unshift({ $match: { [deletedField]: { $ne: true } } });
        }
      });
    }
  }

  // Instance method: softDelete
  schema.methods.softDelete = async function (this: any, deletedById?: string): Promise<any> {
    this[deletedField] = true;
    this[deletedAtField] = new Date();
    if (deletedByField && deletedById) {
      this[deletedByField] = deletedById;
    }
    return this.save();
  };

  // Instance method: restore
  schema.methods.restore = async function (this: any): Promise<any> {
    this[deletedField] = false;
    this[deletedAtField] = null;
    if (deletedByField) {
      this[deletedByField] = null;
    }
    return this.save();
  };

  // Static method: softDeleteById
  schema.statics.softDeleteById = async function (
    this: Model<any>,
    id: string,
    deletedById?: string,
  ): Promise<any | null> {
    const update: Record<string, unknown> = {
      [deletedField]: true,
      [deletedAtField]: new Date(),
    };
    if (deletedByField && deletedById) {
      update[deletedByField] = deletedById;
    }
    return this.findByIdAndUpdate(id, update, { returnDocument: 'after' });
  };

  // Static method: softDeleteMany
  schema.statics.softDeleteMany = async function (
    this: Model<any>,
    filter: object,
    deletedById?: string,
  ): Promise<number> {
    const update: Record<string, unknown> = {
      [deletedField]: true,
      [deletedAtField]: new Date(),
    };
    if (deletedByField && deletedById) {
      update[deletedByField] = deletedById;
    }
    const result = await this.updateMany(filter, update);
    return result.modifiedCount;
  };

  // Static method: restoreById
  schema.statics.restoreById = async function (this: Model<any>, id: string): Promise<any | null> {
    const update: Record<string, unknown> = {
      [deletedField]: false,
      [deletedAtField]: null,
    };
    if (deletedByField) {
      update[deletedByField] = null;
    }
    return this.findByIdAndUpdate(id, update, { returnDocument: 'after' });
  };

  // Static method: restoreMany
  schema.statics.restoreMany = async function (this: Model<any>, filter: object): Promise<number> {
    const update: Record<string, unknown> = {
      [deletedField]: false,
      [deletedAtField]: null,
    };
    if (deletedByField) {
      update[deletedByField] = null;
    }
    const result = await this.updateMany({ ...filter, [deletedField]: true }, update);
    return result.modifiedCount;
  };

  // Static method: findDeleted - find only deleted documents
  schema.statics.findDeleted = function (this: Model<any>, filter: object = {}): Query<any[], any> {
    return this.find({ ...filter, [deletedField]: true }).setOptions({
      includeDeleted: true,
    });
  };

  // Static method: findWithDeleted - find all documents including deleted
  schema.statics.findWithDeleted = function (
    this: Model<any>,
    filter: object = {},
  ): Query<any[], any> {
    return this.find(filter).setOptions({ includeDeleted: true });
  };

  // Static method: countDeleted - count only deleted documents
  schema.statics.countDeleted = async function (
    this: Model<any>,
    filter: object = {},
  ): Promise<number> {
    return this.countDocuments({ ...filter, [deletedField]: true }).setOptions({
      includeDeleted: true,
    });
  };
}

export default softDeletePlugin;
