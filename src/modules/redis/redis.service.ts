import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.types';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: Redis;

  constructor(private configService: ConfigService<AllConfigType>) {
    this.client = new Redis({
      host: this.configService.getOrThrow('redis.host', { infer: true }),
      port: this.configService.getOrThrow('redis.port', { infer: true }),
      password: this.configService.getOrThrow('redis.password', { infer: true }),
      db: this.configService.getOrThrow('redis.db', { infer: true }),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async setWithExpiry(key: string, value: any, seconds: number): Promise<void> {
    await this.set(key, value, seconds);
  }

  async getTTL(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async deletePattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await this.client.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  async onApplicationShutdown() {
    await this.client.quit();
    console.log('🛑 Redis connection closed gracefully');
  }

  getClient(): Redis {
    return this.client;
  }
}
