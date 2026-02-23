import { Document, Model, Query } from 'mongoose';

/**
 * Soft Delete Plugin Options
 */
export interface SoftDeleteOptions {
  /** Field name for deleted flag (default: 'isDeleted') */
  deletedField?: string;
  /** Field name for deletion timestamp (default: 'deletedAt') */
  deletedAtField?: string;
  /** Field name for the user who deleted (default: 'deletedBy') */
  deletedByField?: string;
  /** Whether to create indexes on delete fields (default: true) */
  indexFields?: boolean;
  /** Whether to override find methods by default (default: true) */
  overrideMethods?: boolean | string[];
}

/**
 * Audit Trail Plugin Options
 */
export interface AuditTrailOptions {
  /** Whether to track IP addresses (default: false) */
  trackIp?: boolean;
  /** Whether to maintain change history (default: false) */
  trackHistory?: boolean;
  /** Maximum history entries to keep (default: 100) */
  maxHistoryEntries?: number;
  /** Field name for created by (default: 'createdBy') */
  createdByField?: string;
  /** Field name for updated by (default: 'updatedBy') */
  updatedByField?: string;
}

/**
 * Pagination Plugin Options
 */
export interface PaginationOptions {
  /** Default page size (default: 10) */
  defaultLimit?: number;
  /** Maximum allowed page size (default: 100) */
  maxLimit?: number;
  /** Custom labels for pagination response */
  customLabels?: PaginationLabels;
}

export interface PaginationLabels {
  docs?: string;
  totalDocs?: string;
  limit?: string;
  page?: string;
  totalPages?: string;
  hasNextPage?: string;
  hasPrevPage?: string;
  nextPage?: string;
  prevPage?: string;
  pagingCounter?: string;
}

export interface PaginateQuery {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  select?: string | Record<string, 0 | 1>;
  populate?: string | object | (string | object)[];
  lean?: boolean;
}

export interface PaginateResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
  pagingCounter: number;
}

/**
 * Auto Slug Plugin Options
 */
export interface AutoSlugOptions {
  /** Source fields to generate slug from */
  sourceFields: string[];
  /** Field name for slug (default: 'slug') */
  slugField?: string;
  /** Whether slug should be unique (default: true) */
  unique?: boolean;
  /** Whether to update slug on document update (default: false) */
  updateOnChange?: boolean;
  /** Custom slugify function */
  slugify?: (text: string) => string;
  /** Strategy for combining source fields: 'merge' (default) or 'firstFound' */
  sourceStrategy?: 'merge' | 'firstFound';
}

/**
 * Encryption Plugin Options
 */
export interface EncryptionOptions {
  /** Fields to encrypt */
  fields: string[];
  /** Encryption secret/key */
  secret: string;
  /** Encryption algorithm (default: 'aes-256-gcm') */
  algorithm?: string;
}

/**
 * Extended Document interface with soft delete methods
 */
export interface SoftDeleteDocument extends Document {
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy?: string | null;
  softDelete(deletedBy?: string): Promise<this>;
  restore(): Promise<this>;
}

/**
 * Extended Model interface with soft delete static methods
 */
export interface SoftDeleteModel<T extends SoftDeleteDocument> extends Model<T> {
  softDeleteById(id: string, deletedBy?: string): Promise<T | null>;
  softDeleteMany(filter: object, deletedBy?: string): Promise<number>;
  restoreById(id: string): Promise<T | null>;
  restoreMany(filter: object): Promise<number>;
  findDeleted(filter?: object): Query<T[], T>;
  findWithDeleted(filter?: object): Query<T[], T>;
  countDeleted(filter?: object): Promise<number>;
}

/**
 * Extended Document interface with audit trail fields
 */
export interface AuditTrailDocument extends Document {
  createdBy?: string;
  updatedBy?: string;
  createdByIp?: string;
  updatedByIp?: string;
  changeHistory?: Array<{
    timestamp: Date;
    userId?: string;
    ip?: string;
    changes: Record<string, { from: unknown; to: unknown }>;
  }>;
}

/**
 * Extended Model interface with pagination
 */
export interface PaginateModel<T extends Document> extends Model<T> {
  paginate(filter?: object, options?: PaginateQuery): Promise<PaginateResult<T>>;
}

/**
 * Extended Document interface with slug
 */
export interface SlugDocument extends Document {
  slug: string;
}
