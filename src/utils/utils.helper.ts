import crypto from 'crypto';
import { Types } from 'mongoose';

/**
 * Normalizes a filename by replacing spaces with lodash, truncating the name to fit within a 20 character limit,
 * and appending a timestamp to ensure uniqueness.
 *
 * @param {string} str - The original filename.
 * @returns {string} The normalized filename.
 * @throws {Error} If the file extension cannot be determined.
 */
const normalizeFilename = (str: string): string => {
  const originalName = str.replace(/\s/g, '_');
  const extension = originalName.split('.').pop();

  if (!extension) {
    throw new Error('Failed to determine file extension');
  }

  const truncatedName = originalName.slice(0, 20 - (extension.length + 1));
  const timestamp = Date.now();

  return `${timestamp}_${truncatedName}.${extension}`;
};

/**
 * A utility function that safely handles asynchronous operations.
 * It returns a tuple where the first element is an error (if any) and the second element is the result.
 *
 * @template T - The type of the resolved value of the promise.
 * @param {Promise<T>} promise - The promise to be handled.
 * @returns {Promise<[Error | null, T | null]>} A promise that resolves to a tuple containing an error or the result.
 */
const safeAsync = async <T>(promise: Promise<T>): Promise<[Error | null, T | null]> => {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error as Error, null];
  }
};

/**
 * Checks if a value is a number.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} True if the value is a number, false otherwise.
 */
const isNumber = (value: any): boolean => {
  return typeof value === 'number' && !isNaN(value);
};

/**
 * Delays execution for a specified amount of time.
 *
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified time.
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Capitalizes the first letter of a string.
 *
 * @param {string} str - The string to capitalize.
 * @returns {string} The string with the first letter capitalized.
 */
const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Throttles a function to limit execution within a given timeframe.
 *
 * @param {Function} func - The function to throttle.
 * @param {number} limit - The time limit in milliseconds.
 * @returns {Function} The throttled function.
 */
const throttle = (func: (...args: any[]) => void, limit: number) => {
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;

  return function (...args: any[]) {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= limit) {
            func(...args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - lastRan),
      );
    }
  };
};

/**
 * Debounces a function to prevent excessive execution.
 *
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timer: NodeJS.Timeout;
  return function (...args: any[]) {
    clearTimeout(timer);

    timer = setTimeout(() => func(...args), delay);
  };
};

/**
 * Parses a JSON string safely without throwing errors.
 *
 * @param {string} jsonString - The JSON string to parse.
 * @returns {any | null} The parsed JSON object, or null if parsing fails.
 */
const safeJsonParse = (jsonString: string): any => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
};

/**
 * Generates a slug from a string.
 *
 * @param {string} text - The input string.
 * @returns {string} The generated slug.
 */
const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Encrypts text using AES-256-CBC encryption.
 *
 * @param {string} text - The text to encrypt.
 * @param {string} secretKey - The encryption key (must be 32 bytes).
 * @returns {string} The encrypted text in base64 format.
 */
const encryptText = (text: string, secretKey: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `${iv.toString('base64')}:${encrypted}`;
};

/**
 * Decrypts AES-256-CBC encrypted text.
 *
 * @param {string} encryptedText - The encrypted text (iv:data format).
 * @param {string} secretKey - The decryption key.
 * @returns {string} The decrypted text.
 */
const decryptText = (encryptedText: string, secretKey: string): string => {
  const [iv, encrypted] = encryptedText.split(':').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
  let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Synchronizes fullName with firstName and lastName fields.
 * If only fullName is provided, it splits into firstName and lastName.
 * If firstName or lastName are provided, it generates fullName.
 *
 * @param {object} update - Object containing name fields to synchronize.
 * @returns {object} The updated object with synchronized name fields.
 */
const synchronizeNameFields = (
  update: Partial<{
    fullName?: string;
    firstName?: string;
    lastName?: string;
  }>,
): { fullName?: string; firstName?: string; lastName?: string } => {
  if (!update?.firstName && !update?.lastName && !update?.fullName) return update;
  if (update.fullName && !update.firstName && !update.lastName) {
    const nameParts = update.fullName?.split(/\s+/);
    update.firstName = nameParts.slice(0, -1).join(' ').trim() || nameParts[0].trim();
    update.lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : '';
  } else {
    const firstName = update.firstName?.trim() || '';
    const lastName = update.lastName?.trim() || '';
    update.fullName = `${firstName} ${lastName}`.trim();
  }
  return update;
};

/**
 * Checks if a string is a valid MongoDB ObjectId.
 *
 * @param {string} id - The string to validate.
 * @returns {boolean} True if valid ObjectId format, false otherwise.
 */
const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;
};

/**
 * Converts a string ID to MongoDB ObjectId.
 * Returns null if the ID is invalid.
 *
 * @param {string} id - The string ID to convert.
 * @returns {Types.ObjectId | null} The ObjectId or null if invalid.
 */
const toObjectId = (id: string): Types.ObjectId | null => {
  if (!id || !isValidObjectId(id)) {
    return null;
  }
  return new Types.ObjectId(id);
};

/**
 * Converts a string ID to MongoDB ObjectId.
 * Throws an error if the ID is invalid.
 *
 * @param {string} id - The string ID to convert.
 * @returns {Types.ObjectId} The ObjectId.
 * @throws {Error} If the ID is invalid.
 */
const toObjectIdOrThrow = (id: string): Types.ObjectId => {
  if (!id || !isValidObjectId(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
  return new Types.ObjectId(id);
};

/**
 * Converts an array of string IDs to MongoDB ObjectIds.
 * Filters out invalid IDs and removes duplicates by default.
 *
 * @param {string[]} ids - Array of string IDs to convert.
 * @param {object} options - Conversion options.
 * @param {boolean} [options.throwOnInvalid=false] - If true, throws error on first invalid ID.
 * @param {boolean} [options.removeDuplicates=true] - If true, removes duplicate ObjectIds.
 * @returns {Types.ObjectId[]} Array of ObjectIds.
 * @throws {Error} If throwOnInvalid is true and an invalid ID is found.
 */
const toObjectIds = (
  ids: string[],
  options: { throwOnInvalid?: boolean; removeDuplicates?: boolean } = {},
): Types.ObjectId[] => {
  const { throwOnInvalid = false, removeDuplicates = true } = options;

  if (!Array.isArray(ids)) {
    if (throwOnInvalid) {
      throw new Error('Input must be an array of string IDs');
    }
    return [];
  }

  const objectIds: Types.ObjectId[] = [];
  const seenIds = new Set<string>();

  for (const id of ids) {
    if (typeof id !== 'string') {
      if (throwOnInvalid) {
        throw new Error(`Invalid ID type: expected string, got ${typeof id}`);
      }
      continue;
    }

    if (!isValidObjectId(id)) {
      if (throwOnInvalid) {
        throw new Error(`Invalid ObjectId: ${id}`);
      }
      continue;
    }

    if (removeDuplicates) {
      if (seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
    }

    objectIds.push(new Types.ObjectId(id));
  }

  return objectIds;
};

/**
 * Extracts ObjectId values from an array of objects with _id field.
 * Useful for extracting IDs from query results.
 *
 * @param {Array<{ _id: Types.ObjectId | string }>} docs - Array of documents with _id.
 * @returns {Types.ObjectId[]} Array of ObjectIds.
 */
const extractObjectIds = <T extends { _id: Types.ObjectId | string }>(
  docs: T[],
): Types.ObjectId[] => {
  if (!Array.isArray(docs)) {
    return [];
  }

  return docs
    .filter((doc) => doc?._id)
    .map((doc) =>
      doc._id instanceof Types.ObjectId ? doc._id : new Types.ObjectId(String(doc._id)),
    );
};

export {
  normalizeFilename,
  safeAsync,
  isNumber,
  sleep,
  capitalizeFirstLetter,
  throttle,
  debounce,
  safeJsonParse,
  generateSlug,
  encryptText,
  decryptText,
  synchronizeNameFields,
  isValidObjectId,
  toObjectId,
  toObjectIdOrThrow,
  toObjectIds,
  extractObjectIds,
};
