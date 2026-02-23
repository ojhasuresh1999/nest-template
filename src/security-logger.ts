import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logDir = process.env['LOG_DIR'] || 'logs';

/**
 * Security Logger - Dedicated logger for security events
 * Logs authentication, authorization, and suspicious activity events
 */
export const securityLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json(),
  ),
  defaultMeta: { service: 'security' },
  transports: [
    // Console transport for development
    new transports.Console({
      level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'debug',
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${String(timestamp)}] [SECURITY] ${String(level)}: ${String(message)}${metaStr}`;
        }),
      ),
    }),

    // Security events file - all security-related logs
    new DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'info',
    }),

    // Security errors file - only errors and critical events
    new DailyRotateFile({
      filename: path.join(logDir, 'security-errors-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'error',
    }),
  ],
});

// Add stream for Morgan if needed
export const securityLogStream = {
  write: (message: string) => {
    securityLogger.info(message.trim());
  },
};
