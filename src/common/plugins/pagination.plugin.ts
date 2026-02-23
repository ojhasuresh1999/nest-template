import { Schema, Model, Document, PopulateOptions, PipelineStage } from 'mongoose';
import { PaginationOptions, PaginateQuery, PaginateResult } from './plugin.types';

const defaultOptions: Required<PaginationOptions> = {
  defaultLimit: 10,
  maxLimit: 100,
  customLabels: {},
};

const defaultLabels = {
  docs: 'docs',
  totalDocs: 'totalDocs',
  limit: 'limit',
  page: 'page',
  totalPages: 'totalPages',
  hasNextPage: 'hasNextPage',
  hasPrevPage: 'hasPrevPage',
  nextPage: 'nextPage',
  prevPage: 'prevPage',
  pagingCounter: 'pagingCounter',
};

/**
 * Production-level Pagination Plugin for Mongoose
 *
 * Features:
 * - Offset-based pagination with metadata
 * - Cursor-based pagination for large datasets
 * - Configurable limits and labels
 * - Sorting, selecting, and populating support
 * - Lean queries for better performance
 *
 * @example
 * ```typescript
 * import { paginationPlugin } from 'src/common/plugins';
 *
 * UserSchema.plugin(paginationPlugin, { defaultLimit: 20, maxLimit: 50 });
 *
 * // Usage
 * const result = await UserModel.paginate(
 *   { isActive: true },
 *   {
 *     page: 1,
 *     limit: 10,
 *     sort: { createdAt: -1 },
 *     populate: 'role',
 *     select: 'firstName lastName email'
 *   }
 * );
 *
 * // Result structure
 * {
 *   docs: [...],
 *   totalDocs: 100,
 *   limit: 10,
 *   page: 1,
 *   totalPages: 10,
 *   hasNextPage: true,
 *   hasPrevPage: false,
 *   nextPage: 2,
 *   prevPage: null,
 *   pagingCounter: 1
 * }
 * ```
 */
export function paginationPlugin<T extends Document>(
  schema: Schema<T>,
  options: PaginationOptions = {},
): void {
  const opts = { ...defaultOptions, ...options };
  const labels = { ...defaultLabels, ...opts.customLabels };

  /**
   * Paginate documents with offset-based pagination
   */
  schema.statics.paginate = async function (
    this: Model<T>,
    filter: object = {},
    queryOptions: PaginateQuery = {},
  ): Promise<PaginateResult<T>> {
    const {
      page = 1,
      limit = opts.defaultLimit,
      sort = { createdAt: -1 },
      select,
      populate,
      lean = true,
    } = queryOptions;

    // Ensure limit doesn't exceed max
    const effectiveLimit = Math.min(Math.max(1, limit), opts.maxLimit);
    const effectivePage = Math.max(1, page);
    const skip = (effectivePage - 1) * effectiveLimit;

    // Build query

    let query: any = this.find(filter);

    // Apply sort
    if (sort) {
      query = query.sort(sort);
    }

    // Apply select
    if (select) {
      query = query.select(select);
    }

    // Apply skip and limit
    query = query.skip(skip).limit(effectiveLimit);

    // Apply populate
    if (populate) {
      if (Array.isArray(populate)) {
        for (const pop of populate) {
          query = query.populate(pop as PopulateOptions);
        }
      } else {
        query = query.populate(populate as PopulateOptions);
      }
    }

    // Apply lean for better performance
    if (lean) {
      query = query.lean();
    }

    // Execute queries in parallel
    const [docs, totalDocs] = await Promise.all([query.exec(), this.countDocuments(filter).exec()]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalDocs / effectiveLimit);
    const hasNextPage = effectivePage < totalPages;
    const hasPrevPage = effectivePage > 1;
    const pagingCounter = skip + 1;

    // Build result with custom labels
    return {
      [labels.docs]: docs,
      [labels.totalDocs]: totalDocs,
      [labels.limit]: effectiveLimit,
      [labels.page]: effectivePage,
      [labels.totalPages]: totalPages,
      [labels.hasNextPage]: hasNextPage,
      [labels.hasPrevPage]: hasPrevPage,
      [labels.nextPage]: hasNextPage ? effectivePage + 1 : null,
      [labels.prevPage]: hasPrevPage ? effectivePage - 1 : null,
      [labels.pagingCounter]: pagingCounter,
    } as unknown as PaginateResult<T>;
  };

  /**
   * Cursor-based pagination for efficient large dataset traversal
   */
  schema.statics.cursorPaginate = async function (
    this: Model<T>,
    filter: object = {},
    queryOptions: {
      limit?: number;
      cursor?: string;
      sortField?: string;
      sortDirection?: 1 | -1;
      select?: string | Record<string, 0 | 1>;
      populate?: PopulateOptions | PopulateOptions[];
    } = {},
  ): Promise<{
    docs: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const {
      limit = opts.defaultLimit,
      cursor,
      sortField = '_id',
      sortDirection = -1,
      select,
      populate,
    } = queryOptions;

    const effectiveLimit = Math.min(Math.max(1, limit), opts.maxLimit);

    // Build filter with cursor
    let cursorFilter = { ...filter };
    if (cursor) {
      const operator = sortDirection === -1 ? '$lt' : '$gt';
      cursorFilter = {
        ...cursorFilter,
        [sortField]: { [operator]: cursor },
      };
    }

    // Build query

    let query: any = this.find(cursorFilter)
      .sort({ [sortField]: sortDirection })
      .limit(effectiveLimit + 1);

    if (select) {
      query = query.select(select);
    }

    if (populate) {
      if (Array.isArray(populate)) {
        for (const pop of populate) {
          query = query.populate(pop);
        }
      } else {
        query = query.populate(populate);
      }
    }

    const docs = await query.lean().exec();

    // Check if there are more documents
    const hasMore = docs.length > effectiveLimit;
    if (hasMore) {
      docs.pop();
    }

    // Get next cursor from last document
    const lastDoc = docs[docs.length - 1];
    const nextCursor =
      hasMore && lastDoc ? String((lastDoc as Record<string, unknown>)[sortField]) : null;

    return {
      docs: docs as T[],
      nextCursor,
      hasMore,
    };
  };

  /**
   * Get aggregation with pagination support
   */
  schema.statics.aggregatePaginate = async function (
    this: Model<T>,
    pipeline: PipelineStage[],
    queryOptions: PaginateQuery = {},
  ): Promise<PaginateResult<T>> {
    const { page = 1, limit = opts.defaultLimit } = queryOptions;

    const effectiveLimit = Math.min(Math.max(1, limit), opts.maxLimit);
    const effectivePage = Math.max(1, page);
    const skip = (effectivePage - 1) * effectiveLimit;

    // Add count and docs facets
    const paginatedPipeline: PipelineStage[] = [
      ...pipeline,
      {
        $facet: {
          docs: [{ $skip: skip }, { $limit: effectiveLimit }],
          totalDocs: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.aggregate(paginatedPipeline).exec();

    const docs = result?.docs || [];
    const totalDocs = result?.totalDocs?.[0]?.count || 0;
    const totalPages = Math.ceil(totalDocs / effectiveLimit);

    return {
      docs,
      totalDocs,
      limit: effectiveLimit,
      page: effectivePage,
      totalPages,
      hasNextPage: effectivePage < totalPages,
      hasPrevPage: effectivePage > 1,
      nextPage: effectivePage < totalPages ? effectivePage + 1 : null,
      prevPage: effectivePage > 1 ? effectivePage - 1 : null,
      pagingCounter: skip + 1,
    };
  };
}

export default paginationPlugin;
