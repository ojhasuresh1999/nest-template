/**
 * Production-level Mongoose Plugins
 *
 * This module provides reusable, well-tested plugins for common
 * MongoDB/Mongoose operations in production applications.
 *
 * @module plugins
 */

// Plugin implementations
export { softDeletePlugin, default as SoftDeletePlugin } from './soft-delete.plugin';
export {
  auditTrailPlugin,
  setAsyncLocalStorage,
  withAudit,
  default as AuditTrailPlugin,
} from './audit-trail.plugin';
export { paginationPlugin, default as PaginationPlugin } from './pagination.plugin';
export { autoSlugPlugin, default as AutoSlugPlugin } from './auto-slug.plugin';
export {
  encryptionPlugin,
  createEncryptor,
  default as EncryptionPlugin,
} from './encryption.plugin';

// Types
export type {
  SoftDeleteOptions,
  SoftDeleteDocument,
  SoftDeleteModel,
  AuditTrailOptions,
  AuditTrailDocument,
  PaginationOptions,
  PaginationLabels,
  PaginateQuery,
  PaginateResult,
  PaginateModel,
  AutoSlugOptions,
  SlugDocument,
  EncryptionOptions,
} from './plugin.types';
