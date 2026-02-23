import { createLogger, format, transports } from 'winston';
import { utilities } from 'nest-winston';
import LokiTransport from 'winston-loki';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const appName = `${process.env['PROJECT_NAME']}-${process.env['NODE_ENV']}` || 'nest-api';
const logDir = process.env['LOG_DIR'] || 'logs';
const isProduction = process.env['NODE_ENV'] === 'production';

const logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
  ),
  defaultMeta: { service: appName },
});

// Console transport - pretty print for development
logger.add(
  new transports.Console({
    level: isProduction ? 'info' : 'silly',
    format: utilities.format.nestLike(appName, {
      colors: !isProduction,
      prettyPrint: !isProduction,
      processId: true,
    }),
  }),
);

// File transport - daily rotation for all logs
if (isProduction || process.env['ENABLE_FILE_LOGS'] === 'true') {
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
      format: format.combine(format.timestamp(), format.json()),
    }),
  );

  // Error-specific file transport
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: format.combine(format.timestamp(), format.json()),
    }),
  );
}

// Loki transport for centralized logging
if (process.env['USE_LOKI'] === 'true') {
  const basicAuthUser = process.env['TRACING_BASIC_AUTH_USER'];
  const basicAuthPassword = process.env['TRACING_BASIC_AUTH_PASSWORD'];

  logger.add(
    new LokiTransport({
      host: process.env['LOKI_HOST'] ?? 'http://127.0.0.1:3100',
      json: true,
      labels: { app: appName },
      format: format.json(),
      basicAuth:
        basicAuthUser && basicAuthPassword ? `${basicAuthUser}:${basicAuthPassword}` : undefined,
    }),
  );
}

export { logger };
