import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiError } from '../errors/api-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;
    let isOperational = false;
    let stack: string | undefined;

    if (exception instanceof ApiError) {
      statusCode = exception.statusCode;
      message = exception.message;
      details = exception.details;
      isOperational = exception.isOperational;
      stack = exception.stack;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const errorResponse = exceptionResponse as any;
        message = errorResponse.message || exception.message;
        if (Array.isArray(errorResponse.message)) {
          details = errorResponse.message.map((msg: string) => ({ message: msg }));
        }
      } else {
        message = exception.message;
      }
      isOperational = true;
      stack = exception.stack;
    } else if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    }

    if (statusCode >= 500 || !isOperational) {
      this.logger.error(`[${request.method}] ${request.url} - ${statusCode} - ${message}`, stack);
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${statusCode} - ${message}`);
    }

    const responseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV !== 'production' && { stack }),
    };

    response.status(statusCode).json(responseBody);
  }
}
