import { Schema, Model, CallbackError } from 'mongoose';
import { AuditTrailOptions, AuditTrailDocument } from './plugin.types';

const defaultOptions: Required<AuditTrailOptions> = {
  trackIp: false,
  trackHistory: false,
  maxHistoryEntries: 100,
  createdByField: 'createdBy',
  updatedByField: 'updatedBy',
};

// AsyncLocalStorage for request context (optional integration)
let asyncLocalStorage: { getStore: () => { userId?: string; ip?: string } | undefined } | null =
  null;

/**
 * Set the async local storage instance for automatic context retrieval
 * This should be called once during application bootstrap
 *
 * @example
 * ```typescript
 * import { AsyncLocalStorage } from 'async_hooks';
 * import { setAsyncLocalStorage } from 'src/common/plugins';
 *
 * const als = new AsyncLocalStorage();
 * setAsyncLocalStorage(als);
 * ```
 */
export function setAsyncLocalStorage(
  als: { getStore: () => { userId?: string; ip?: string } | undefined } | null,
): void {
  asyncLocalStorage = als;
}

/**
 * Get current request context from async local storage
 */
function getRequestContext(): { userId?: string; ip?: string } {
  if (asyncLocalStorage) {
    return asyncLocalStorage.getStore() || {};
  }
  return {};
}

/**
 * Production-level Audit Trail Plugin for Mongoose
 *
 * Features:
 * - Automatically tracks createdBy/updatedBy user references
 * - Optional IP address tracking
 * - Optional change history with field-level tracking
 * - Integrates with AsyncLocalStorage for automatic context
 * - Manual override via save options
 *
 * @example
 * ```typescript
 * import { auditTrailPlugin } from 'src/common/plugins';
 *
 * InterestSchema.plugin(auditTrailPlugin, {
 *   trackIp: true,
 *   trackHistory: true,
 *   maxHistoryEntries: 50
 * });
 *
 * // When saving with explicit user context
 * await document.save({ userId: 'user123', ip: '192.168.1.1' });
 *
 * // Or rely on AsyncLocalStorage context
 * await document.save();
 * ```
 */
export function auditTrailPlugin<T extends AuditTrailDocument>(
  schema: Schema<T>,
  options: AuditTrailOptions = {},
): void {
  const opts = { ...defaultOptions, ...options };
  const { trackIp, trackHistory, maxHistoryEntries, createdByField, updatedByField } = opts;

  // Add audit fields to schema
  schema.add({
    [createdByField]: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  } as Parameters<typeof schema.add>[0]);

  schema.add({
    [updatedByField]: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  } as Parameters<typeof schema.add>[0]);

  if (trackIp) {
    schema.add({
      [`${createdByField}Ip`]: {
        type: String,
        default: null,
      },
    } as Parameters<typeof schema.add>[0]);

    schema.add({
      [`${updatedByField}Ip`]: {
        type: String,
        default: null,
      },
    } as Parameters<typeof schema.add>[0]);
  }

  if (trackHistory) {
    schema.add({
      changeHistory: {
        type: [
          {
            timestamp: { type: Date, default: Date.now },
            userId: { type: Schema.Types.ObjectId, ref: 'User' },
            ip: String,
            changes: { type: Schema.Types.Mixed },
          },
        ],
        default: [],
        select: false,
      },
    } as Parameters<typeof schema.add>[0]);
  }

  // Pre-save hook for new documents
  schema.pre('save', function (this: T, next: (err?: CallbackError) => void) {
    const context = getRequestContext();
    const saveOptions =
      (this.$locals as { auditContext?: { userId?: string; ip?: string } })?.auditContext || {};
    const userId = saveOptions.userId || context.userId;
    const ip = saveOptions.ip || context.ip;

    if (this.isNew) {
      // Set createdBy for new documents
      if (userId && !(this as Record<string, unknown>)[createdByField]) {
        (this as Record<string, unknown>)[createdByField] = userId;
      }
      if (trackIp && ip) {
        (this as Record<string, unknown>)[`${createdByField}Ip`] = ip;
      }
    } else {
      // Set updatedBy for existing documents
      if (userId) {
        (this as Record<string, unknown>)[updatedByField] = userId;
      }
      if (trackIp && ip) {
        (this as Record<string, unknown>)[`${updatedByField}Ip`] = ip;
      }

      // Track change history if enabled
      if (trackHistory && this.isModified()) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        const modifiedPaths = this.modifiedPaths();

        for (const path of modifiedPaths) {
          // Skip internal fields
          if (
            path.startsWith('_') ||
            path === 'changeHistory' ||
            path === createdByField ||
            path === updatedByField ||
            path.includes('Ip')
          ) {
            continue;
          }

          const currentValue = this.get(path, undefined, { getters: false });
          changes[path] = {
            from: undefined, // Previous value not easily accessible in pre-save
            to: currentValue,
          };
        }

        if (Object.keys(changes).length > 0) {
          const history =
            ((this as Record<string, unknown>).changeHistory as Array<{
              timestamp: Date;
              userId?: string;
              ip?: string;
              changes: Record<string, { from: unknown; to: unknown }>;
            }>) || [];

          history.push({
            timestamp: new Date(),
            userId,
            ip,
            changes,
          });

          // Trim history if exceeds max entries
          if (history.length > maxHistoryEntries) {
            history.splice(0, history.length - maxHistoryEntries);
          }

          (this as Record<string, unknown>).changeHistory = history;
        }
      }
    }

    next();
  });

  // Pre findOneAndUpdate hook
  schema.pre('findOneAndUpdate', async function (next: (err?: CallbackError) => void) {
    const context = getRequestContext();
    const update = this.getUpdate() as Record<string, unknown> | null;

    if (update) {
      const userId = context.userId;
      const ip = context.ip;

      if (userId) {
        update[updatedByField] = userId;
      }
      if (trackIp && ip) {
        update[`${updatedByField}Ip`] = ip;
      }

      this.setUpdate(update);
    }

    next();
  });

  // Static method to set audit context for batch operations
  schema.statics.withAuditContext = function (this: Model<T>, userId: string, ip?: string) {
    return {
      userId,
      ip,
      model: this,
    };
  };
}

/**
 * Helper to set audit context on a document before saving
 *
 * @example
 * ```typescript
 * import { withAudit } from 'src/common/plugins';
 *
 * const doc = new UserModel(data);
 * await withAudit(doc, userId, ip).save();
 * ```
 */
export function withAudit<T extends AuditTrailDocument>(
  document: T,
  userId: string,
  ip?: string,
): T {
  (document.$locals as { auditContext: { userId: string; ip?: string } }).auditContext = {
    userId,
    ip,
  };
  return document;
}

export default auditTrailPlugin;
