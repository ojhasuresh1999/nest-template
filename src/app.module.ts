import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './common/modules/firebase.module';
import { MailModule } from './common/modules/mail.module';
import { S3Module } from './common/modules/s3.module';
import { AllConfigsList } from './config/all-configs-list';
import { AllConfigType } from './config/config.types';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { QueueModule } from './modules/queue/queue.module';
import { RedisModule } from './modules/redis/redis.module';
import { RoleModule } from './modules/role/role.module';
import { UploadModule } from './modules/upload/upload.module';
import { UserModule } from './modules/user/user.module';
import { InterestsModule } from './modules/interests/interests.module';
import { S3HealthIndicator, FirebaseHealthIndicator } from './common/health';
import { CircuitBreakerModule } from './common/circuit-breaker';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: AllConfigsList,
      envFilePath: ['.env'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        uri: configService.getOrThrow<string>('db.uri', { infer: true }),
        dbName: configService.getOrThrow<string>('db.database', { infer: true }),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService<AllConfigType>) => ({
        store: await redisStore({
          socket: {
            host: configService.getOrThrow('redis.host', { infer: true }),
            port: configService.getOrThrow('redis.port', { infer: true }),
          },
          password: configService.getOrThrow('redis.password', { infer: true }),
          database: configService.getOrThrow('redis.db', { infer: true }),
          ttl: 30000,
        }),
        max: 1000,
      }),
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
    RoleModule,
    MailModule,
    FirebaseModule,
    TerminusModule,
    RedisModule,
    QueueModule,
    ChatModule,
    NotificationModule,
    S3Module,
    UploadModule,
    InterestsModule,
    CircuitBreakerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    S3HealthIndicator,
    FirebaseHealthIndicator,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
