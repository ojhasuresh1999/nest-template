/**
 * OTP Purpose Enum
 * Defines the different purposes for which OTP can be sent
 */
export enum OtpPurpose {
  REGISTRATION = 'REGISTRATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_CHANGE = 'EMAIL_CHANGE',
  PHONE_VERIFICATION = 'PHONE_VERIFICATION',
  LOGIN_VERIFICATION = 'LOGIN_VERIFICATION',
}

/**
 * OTP Configuration
 */
export interface OtpConfig {
  /** Length of the OTP (default: 4) */
  length: number;
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttlSeconds: number;
  /** Maximum attempts before lockout */
  maxAttempts: number;
}

/**
 * Default OTP configuration
 */
export const DEFAULT_OTP_CONFIG: OtpConfig = {
  length: 4,
  ttlSeconds: 300, // 5 minutes
  maxAttempts: 3,
};

/**
 * OTP stored data structure
 */
export interface StoredOtp {
  code: string;
  attempts: number;
  createdAt: number;
}
