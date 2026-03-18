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
import { S3HealthIndicator, FirebaseHealthIndicator } from './common/health';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisService,
    private s3Health: S3HealthIndicator,
    private firebaseHealth: FirebaseHealthIndicator,
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
  async check() {
    const checks: HealthIndicatorFunction[] = [
      () => this.db.pingCheck('database'),
      () => this.checkRedis(),
      () => this.s3Health.isHealthy('s3'),
      () => this.firebaseHealth.isHealthy('firebase'),
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

    const healthResult = await this.health.check(checks);

    const memUsage = process.memoryUsage();
    const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
    const cpuUsage = process.cpuUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeSecs = uptimeSeconds % 60;

    return {
      ...healthResult,
      memory: {
        rss: formatBytes(memUsage.rss),
        heapTotal: formatBytes(memUsage.heapTotal),
        heapUsed: formatBytes(memUsage.heapUsed),
        external: formatBytes(memUsage.external),
        heapUsedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
      },
      cpu: {
        usage: (process.cpuUsage().user / 1000000 / process.uptime()).toFixed(2) + '%',
        user: (cpuUsage.user / 1000000).toFixed(2) + ' sec',
        system: (cpuUsage.system / 1000000).toFixed(2) + ' sec',
      },
      uptime: {
        milliseconds: uptimeSeconds * 1000,
        seconds: uptimeSeconds,
        formatted: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSecs}s`,
      },
      runningSince: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    };
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
