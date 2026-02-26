import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';
import { CACHE_INVALIDATE_PREFIX } from './cache.constants';

@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInvalidationInterceptor.name);

  // 🎨 ANSI COLORS
  private readonly cyan = '\x1b[38;5;45m'; // Cool cyan
  private readonly yellow = '\x1b[38;5;226m'; // Bright yellow
  private readonly coral = '\x1b[38;5;203m'; // Soft red
  private readonly gray = '\x1b[90m'; // Subtle gray
  private readonly bold = '\x1b[1m';
  private readonly reset = '\x1b[0m';

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const prefixes = this.reflector.get<string[]>(CACHE_INVALIDATE_PREFIX, context.getHandler());

    if (!prefixes?.length) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        for (const prefix of prefixes) {
          try {
            const deleted = await this.redis.deletePattern(`${prefix}:*`);

            if (deleted > 0) {
              this.logger.log(
                `${this.cyan}${this.bold}🧹 CACHE INVALIDATED${this.reset} ` +
                  `${this.yellow}${deleted}${this.reset} ` +
                  `${this.gray}keys → "${prefix}"${this.reset}`,
              );
            }
          } catch (err) {
            this.logger.warn(
              `${this.coral}${this.bold}⚠ INVALIDATION FAILED${this.reset} ` +
                `${this.gray}for "${prefix}" → ${err}${this.reset}`,
            );
          }
        }
      }),
    );
  }
}
