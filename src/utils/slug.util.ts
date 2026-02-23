import slugify from 'slugify';
import mongoose from 'mongoose';

export async function generateUniqueSlug(
  model: mongoose.Model<any>,
  base: string,
  currentId?: mongoose.Types.ObjectId,
): Promise<string> {
  const baseSlug = slugify(base, {
    lower: true,
    strict: true,
    trim: true,
  });

  let slug = baseSlug;
  let counter = 1;

  while (
    await model.exists({
      slug,
      ...(currentId ? { _id: { $ne: currentId } } : {}),
    })
  ) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
}
