import { createHash } from 'crypto';
import { UAParser } from 'ua-parser-js';

/**
 * Generates a deterministic device ID based on user agent and user ID
 * Same device + same user = same device ID across logins
 */
export function generateDeviceFingerprint(userAgent: string, userId: string): string {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Extract key device characteristics
  const browserName = result.browser.name || 'unknown';
  const browserVersion = result.browser.version || 'unknown';
  const osName = result.os.name || 'unknown';
  const osVersion = result.os.version || 'unknown';
  const deviceType = result.device.type || 'desktop';
  const deviceVendor = result.device.vendor || 'unknown';
  const deviceModel = result.device.model || 'unknown';

  // Create a deterministic fingerprint string
  const fingerprintData = [
    userId, // User-specific
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceType,
    deviceVendor,
    deviceModel,
  ].join('|');

  // Generate SHA-256 hash and return first 32 characters as device ID
  const hash = createHash('sha256').update(fingerprintData).digest('hex');
  return hash.substring(0, 32);
}

/**
 * Parses user agent to extract readable device information
 */
export function parseDeviceInfo(userAgent: string): {
  deviceName: string;
  deviceType: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceVendor: string;
  deviceModel: string;
} {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const browserName = result.browser.name || 'Unknown Browser';
  const browserVersion = result.browser.version || '';
  const osName = result.os.name || 'Unknown OS';
  const osVersion = result.os.version || '';
  const deviceType = result.device.type || 'desktop';
  const deviceVendor = result.device.vendor || '';
  const deviceModel = result.device.model || '';

  // Generate human-readable device name
  let deviceName = `${browserName} on ${osName}`;

  if (deviceVendor && deviceModel) {
    deviceName = `${deviceVendor} ${deviceModel}`;
  }

  return {
    deviceName,
    deviceType,
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceVendor,
    deviceModel,
  };
}
