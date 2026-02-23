import { Schema, CallbackError, Document, Model } from 'mongoose';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { EncryptionOptions } from './plugin.types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from secret using scrypt
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Encrypt a string value
 */
function encrypt(value: string, secret: string): string {
  if (!value || typeof value !== 'string') {
    return value;
  }

  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return [salt.toString('hex'), iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
}

/**
 * Decrypt an encrypted string value
 */
function decrypt(encryptedValue: string, secret: string): string {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    return encryptedValue;
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 4) {
    return encryptedValue;
  }

  try {
    const [saltHex, ivHex, authTagHex, encrypted] = parts;

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = deriveKey(secret, salt);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return encryptedValue;
  }
}

/**
 * Check if a value appears to be encrypted
 */
function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const parts = value.split(':');
  return (
    parts.length === 4 &&
    parts[0].length === SALT_LENGTH * 2 &&
    parts[1].length === IV_LENGTH * 2 &&
    parts[2].length === AUTH_TAG_LENGTH * 2
  );
}

/**
 * Production-level Field Encryption Plugin for Mongoose
 *
 * Features:
 * - AES-256-GCM encryption with unique salt and IV per encryption
 * - Transparent encrypt on save, decrypt on find
 * - Handles both new documents and updates
 * - Graceful handling of already-encrypted or unencrypted data
 * - Support for field-level encryption configuration
 *
 * IMPORTANT: Store your encryption secret securely (e.g., environment variable).
 * If you lose the secret, encrypted data cannot be recovered.
 *
 * @example
 * ```typescript
 * import { encryptionPlugin } from 'src/common/plugins';
 *
 * UserSchema.plugin(encryptionPlugin, {
 *   fields: ['phone', 'aadhaarNumber', 'panNumber'],
 *   secret: process.env.ENCRYPTION_KEY
 * });
 *
 * // Data is automatically encrypted when saved
 * const user = new User({ phone: '9876543210' });
 * await user.save(); // phone is encrypted in database
 *
 * // Data is automatically decrypted when retrieved
 * const found = await User.findById(user._id);
 * console.log(found.phone); // '9876543210'
 * ```
 */
export function encryptionPlugin<T extends Document>(
  schema: Schema<T>,
  options: EncryptionOptions,
): void {
  const { fields, secret } = options;

  if (!fields || fields.length === 0) {
    throw new Error('encryptionPlugin requires at least one field to encrypt');
  }

  if (!secret || secret.length < 16) {
    throw new Error('encryptionPlugin requires a secret of at least 16 characters');
  }

  /**
   * Encrypt specified fields
   */
  function encryptFields(doc: T): void {
    for (const field of fields) {
      const value = doc.get(field);
      if (value && typeof value === 'string' && !isEncrypted(value)) {
        doc.set(field, encrypt(value, secret));
      }
    }
  }

  /**
   * Decrypt specified fields
   */
  function decryptFields(doc: T | Record<string, unknown>): void {
    for (const field of fields) {
      const value = (doc as Record<string, unknown>)[field];
      if (value && typeof value === 'string' && isEncrypted(value)) {
        (doc as Record<string, unknown>)[field] = decrypt(value, secret);
      }
    }
  }

  // Pre-save hook to encrypt fields
  schema.pre('save', function (this: T, next: (err?: CallbackError) => void) {
    encryptFields(this);
    next();
  });

  // Pre findOneAndUpdate hook to encrypt updated fields
  schema.pre('findOneAndUpdate', function (next: (err?: CallbackError) => void) {
    const update = this.getUpdate() as Record<string, unknown> | null;
    if (!update) {
      return next();
    }

    for (const field of fields) {
      // Handle direct field updates
      if (
        update[field] &&
        typeof update[field] === 'string' &&
        !isEncrypted(update[field] as string)
      ) {
        update[field] = encrypt(update[field] as string, secret);
      }

      // Handle $set updates
      if (update.$set && (update.$set as Record<string, unknown>)[field]) {
        const value = (update.$set as Record<string, unknown>)[field];
        if (typeof value === 'string' && !isEncrypted(value)) {
          (update.$set as Record<string, unknown>)[field] = encrypt(value, secret);
        }
      }
    }

    this.setUpdate(update);
    next();
  });

  // Pre updateOne/updateMany hooks
  schema.pre(['updateOne', 'updateMany'], function (next: (err?: CallbackError) => void) {
    const update = this.getUpdate() as Record<string, unknown> | null;
    if (!update) {
      return next();
    }

    for (const field of fields) {
      if (
        update[field] &&
        typeof update[field] === 'string' &&
        !isEncrypted(update[field] as string)
      ) {
        update[field] = encrypt(update[field] as string, secret);
      }

      if (update.$set && (update.$set as Record<string, unknown>)[field]) {
        const value = (update.$set as Record<string, unknown>)[field];
        if (typeof value === 'string' && !isEncrypted(value)) {
          (update.$set as Record<string, unknown>)[field] = encrypt(value, secret);
        }
      }
    }

    this.setUpdate(update);
    next();
  });

  // Post-find hooks to decrypt fields
  schema.post('find', function (docs: T[]) {
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        decryptFields(doc);
      }
    }
  });

  schema.post('findOne', function (doc: T | null) {
    if (doc) {
      decryptFields(doc);
    }
  });

  schema.post('findOneAndUpdate', function (doc: T | null) {
    if (doc) {
      decryptFields(doc);
    }
  });

  // Add instance method to get raw encrypted value
  schema.methods.getEncryptedField = function (this: T, field: string): string | undefined {
    return (this as Record<string, unknown>)[field] as string | undefined;
  };

  // Add static method to search encrypted fields
  schema.statics.findByEncryptedField = async function (
    this: Model<T>,
    field: string,
    value: string,
  ): Promise<T | null> {
    // WARNING: This is not efficient for large collections
    // Consider implementing searchable encryption for production use
    const docs = await this.find({});
    for (const doc of docs) {
      const decryptedValue = decrypt(doc.get(field), secret);
      if (decryptedValue === value) {
        return doc;
      }
    }
    return null;
  };

  // Add static utility methods
  schema.statics.encryptValue = function (value: string): string {
    return encrypt(value, secret);
  };

  schema.statics.decryptValue = function (encryptedValue: string): string {
    return decrypt(encryptedValue, secret);
  };
}

/**
 * Utility function for manual encryption
 */
export function createEncryptor(secret: string) {
  return {
    encrypt: (value: string) => encrypt(value, secret),
    decrypt: (value: string) => decrypt(value, secret),
    isEncrypted: (value: string) => isEncrypted(value),
  };
}

export default encryptionPlugin;
