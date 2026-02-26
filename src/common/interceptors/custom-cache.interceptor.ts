import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';
import { CACHE_KEY_PREFIX } from '../cache/cache.constants';

const DEFAULT_TTL_SECONDS = 30;
const CACHE_TTL_METADATA = 'cache_module:cache_ttl';

@Injectable()
export class CustomCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CustomCacheInterceptor.name);

  private readonly green = '\x1b[38;5;46m';
  private readonly coral = '\x1b[38;5;203m';
  private readonly gray = '\x1b[90m';
  private readonly bold = '\x1b[1m';
  private readonly reset = '\x1b[0m';

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') return next.handle();

    const prefix = this.reflector.get<string>(CACHE_KEY_PREFIX, context.getClass()) ?? '';
    const url = request.originalUrl || request.url;
    const key = prefix ? `${prefix}:${url}` : url;

    try {
      const cached = await this.redis.get<any>(key);

      if (cached !== null && cached !== undefined) {
        this.logger.debug(
          `${this.green}${this.bold}✔ CACHE HIT${this.reset} ${this.gray}→ ${key}${this.reset}`,
        );

        const response =
          typeof cached === 'object' && cached !== null ? { ...cached, cached: true } : cached;

        return of(response);
      }

      this.logger.debug(
        `${this.coral}${this.bold}✖ CACHE MISS${this.reset} ${this.gray}→ ${key}${this.reset}`,
      );
    } catch (err) {
      this.logger.warn(`GET failed for "${key}": ${err}`);
      return next.handle();
    }

    const ttlMs =
      this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler()) ??
      this.reflector.get<number>(CACHE_TTL_METADATA, context.getClass());

    let ttlSeconds: number | undefined = DEFAULT_TTL_SECONDS;
    if (ttlMs === 0) {
      ttlSeconds = undefined; // No expiration
    } else if (ttlMs !== undefined && ttlMs !== null) {
      ttlSeconds = Math.ceil(ttlMs / 1000);
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.redis.set(key, response, ttlSeconds);
          this.logger.log(
            `${this.green}SET${this.reset} ${this.gray}"${key}" TTL=${ttlSeconds}s${this.reset}`,
          );
        } catch (err) {
          this.logger.warn(`SET failed for "${key}": ${err}`);
        }
      }),
    );
  }
}
