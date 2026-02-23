import { Module, Global, OnApplicationShutdown } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  onApplicationShutdown(signal: string) {
    console.log(`⚠️ RedisModule received shutdown signal: ${signal}`);
  }
}
