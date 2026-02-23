import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  MongooseHealthIndicator,
  HealthIndicatorFunction,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisService } from './modules/redis/redis.service';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './modules/auth/decorators';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisService,
  ) {}

  @Get()
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable',
  })
  check() {
    const checks: HealthIndicatorFunction[] = [
      () => this.db.pingCheck('database'),
      () => this.checkRedis(),
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ];

    if (process.env.NODE_ENV === 'production') {
      checks.push(
        () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
        () => this.memory.checkRSS('memory_rss', 700 * 1024 * 1024),
      );
    }

    return this.health.check(checks);
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const status = await this.redis.getClient().ping();
      if (status !== 'PONG') {
        throw new Error('Redis ping failed');
      }
      return { redis: { status: 'up' } };
    } catch (e) {
      return {
        redis: { status: 'down', message: e.message },
      };
    }
  }
}
