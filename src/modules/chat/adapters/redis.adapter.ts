import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, ServerOptions } from 'socket.io';
import { AllConfigType } from '../../../config/config.types';

/**
 * Redis Adapter for Socket.IO
 * Enables horizontal scaling by using Redis pub/sub for cross-instance communication
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisHost = this.configService.getOrThrow('redis.host', { infer: true });
    const redisPort = this.configService.getOrThrow('redis.port', { infer: true });
    const redisPassword = this.configService.get('redis.password', { infer: true });
    const redisDb = this.configService.get('redis.db', { infer: true }) || 0;

    const redisUrl = redisPassword
      ? `redis://:${redisPassword}@${redisHost}:${redisPort}/${redisDb}`
      : `redis://${redisHost}:${redisPort}/${redisDb}`;

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        this.logger.error('Redis pub client error:', err);
      });

      subClient.on('error', (err) => {
        this.logger.error('Redis sub client error:', err);
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('✅ Socket.IO Redis adapter connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis for Socket.IO adapter:', error);
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const socketConfig = this.configService.get('socket', { infer: true });

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: socketConfig?.pingInterval || 25000,
      pingTimeout: socketConfig?.pingTimeout || 30000,
      maxHttpBufferSize: socketConfig?.maxPayloadSize || 1048576,
      allowEIO3: true, // Allow Engine.IO 3 clients
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}

/**
 * Setup Redis adapter for the NestJS application
 */
export async function setupSocketAdapter(
  app: INestApplication,
  configService: ConfigService<AllConfigType>,
): Promise<void> {
  const logger = new Logger('SocketAdapter');

  try {
    const redisIoAdapter = new RedisIoAdapter(app, configService);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    logger.log('✅ Socket.IO WebSocket adapter initialized with Redis');
  } catch (error) {
    logger.warn(
      '⚠️ Failed to initialize Redis adapter for Socket.IO, falling back to default adapter',
      error,
    );
    // Fallback to default adapter if Redis connection fails
    app.useWebSocketAdapter(new IoAdapter(app));
  }
}
