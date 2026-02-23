import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const message =
          this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) ||
          'Request successful';

        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode || 200;

        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          'data' in data &&
          Object.keys(data).length === 2
        ) {
          return data as ApiResponse<T>;
        }

        return {
          statusCode,
          message,
          data: data,
        };
      }),
    );
  }
}
