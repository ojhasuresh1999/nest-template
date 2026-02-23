import { Schema, Model } from 'mongoose';
import slugify from 'slugify';
import { AutoSlugOptions } from './plugin.types';

const defaultOptions: Required<Omit<AutoSlugOptions, 'sourceFields' | 'slugify'>> & {
  sourceFields: string[];
  slugify?: (text: string) => string;
} = {
  sourceFields: ['name'],
  slugField: 'slug',
  unique: true,
  updateOnChange: false,
  slugify: undefined,
  sourceStrategy: 'merge',
};

/**
 * Default slugify function using the slugify library
 */
function defaultSlugify(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Generate a unique slug by appending a numeric suffix if needed
 */
async function generateUniqueSlugForModel(
  model: Model<any>,
  baseSlug: string,
  slugField: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let counter = 0;
  let isUnique = false;

  while (!isUnique) {
    const query: Record<string, unknown> = { [slugField]: slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const exists = await model
      .findOne(query)
      .setOptions({ includeDeleted: true })
      .select('_id')
      .lean()
      .exec();

    if (!exists) {
      isUnique = true;
    } else {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  return slug;
}

/**
 * Production-level Auto-Slug Plugin for Mongoose
 *
 * Features:
 * - Automatic URL-friendly slug generation from specified fields
 * - Guaranteed uniqueness with numeric suffix
 * - Works with both save and update operations
 * - Configurable slugify function
 * - Option to update slug when source fields change
 */
export function autoSlugPlugin(schema: Schema<any>, options: AutoSlugOptions): void {
  if (!options.sourceFields || options.sourceFields.length === 0) {
    throw new Error('autoSlugPlugin requires at least one source field');
  }

  const opts = { ...defaultOptions, ...options };
  const {
    sourceFields,
    slugField,
    unique,
    updateOnChange,
    slugify: customSlugify,
    sourceStrategy,
  } = opts;
  const slugifyFn = customSlugify || defaultSlugify;

  const existingPath = schema.path(slugField);
  if (!existingPath) {
    schema.add({
      [slugField]: {
        type: String,
        unique: unique,
        index: true,
        trim: true,
      },
    } as Parameters<typeof schema.add>[0]);
  }

  /**
   * Generate slug from source fields
   */
  function generateSlugFromFields(doc: any, isUpdate = false): string | null {
    const parts: string[] = [];

    for (const field of sourceFields) {
      const value = isUpdate ? doc[field] : doc.get(field);

      if (value && typeof value === 'string') {
        parts.push(value);
        if (sourceStrategy === 'firstFound') {
          break;
        }
      }
    }

    if (parts.length === 0) return null;
    return slugifyFn(parts.join(' '));
  }

  /**
   * Check if any source field was modified
   */
  function isSourceFieldModified(doc: any): boolean {
    return sourceFields.some((field) => doc.isModified(field));
  }

  schema.pre('save', async function (this: any) {
    const currentSlug = this.get(slugField);
    const isNew = this.isNew;
    const shouldUpdate = isNew || !currentSlug || (updateOnChange && isSourceFieldModified(this));

    if (shouldUpdate) {
      const baseSlug = generateSlugFromFields(this);

      if (baseSlug) {
        let finalSlug = baseSlug;

        if (unique) {
          finalSlug = await generateUniqueSlugForModel(
            this.constructor as Model<any>,
            baseSlug,
            slugField,
            isNew ? undefined : this._id?.toString(),
          );
        }

        this.set(slugField, finalSlug);
      }
    }
  });

  schema.pre('findOneAndUpdate', async function () {
    if (!updateOnChange) {
      return;
    }

    const update = this.getUpdate() as Record<string, unknown> | null;
    if (!update) {
      return;
    }

    const hasSourceFieldUpdate = sourceFields.some(
      (field) =>
        update[field] !== undefined ||
        (update.$set && (update.$set as Record<string, unknown>)[field] !== undefined),
    );

    if (hasSourceFieldUpdate) {
      const doc = await this.model.findOne(this.getQuery()).lean().exec();
      if (!doc) {
        return;
      }

      const mergedDoc: Record<string, unknown> = { ...(doc as Record<string, unknown>) };

      for (const field of sourceFields) {
        const updateValue =
          update[field] || (update.$set && (update.$set as Record<string, unknown>)[field]);
        if (updateValue !== undefined) {
          mergedDoc[field] = updateValue;
        }
      }

      const baseSlug = generateSlugFromFields(mergedDoc, true);

      if (baseSlug) {
        if (unique) {
          const finalSlug = await generateUniqueSlugForModel(
            this.model as Model<any>,
            baseSlug,
            slugField,
            (doc as Record<string, unknown>)._id?.toString(),
          );
          update[slugField] = finalSlug;
        } else {
          update[slugField] = baseSlug;
        }

        this.setUpdate(update);
      }
    }
  });

  // Static method to regenerate slug for existing documents
  schema.statics.regenerateSlug = async function (
    this: Model<any>,
    id: string,
  ): Promise<any | null> {
    const doc = await this.findById(id);
    if (!doc) {
      return null;
    }

    const baseSlug = generateSlugFromFields(doc);
    if (baseSlug) {
      const finalSlug = unique
        ? await generateUniqueSlugForModel(this, baseSlug, slugField, id)
        : baseSlug;

      doc.set(slugField, finalSlug);
      return doc.save();
    }

    return doc;
  };

  // Static method to find by slug
  schema.statics.findBySlug = function (this: Model<any>, slug: string) {
    return this.findOne({ [slugField]: slug });
  };
}

export default autoSlugPlugin;
