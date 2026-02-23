import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllConfigsList } from './config/all-configs-list';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseModule } from './common/modules/firebase.module';
import { MailModule } from './common/modules/mail.module';
import { S3Module } from './common/modules/s3.module';
import { AllConfigType } from './config/config.types';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { QueueModule } from './modules/queue/queue.module';
import { RedisModule } from './modules/redis/redis.module';
import { RoleModule } from './modules/role/role.module';
import { UserModule } from './modules/user/user.module';
import { UploadModule } from './modules/upload/upload.module';

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
        ttl: 60000, // 1 minute in milliseconds
        limit: 100, // 100 requests per minute
      },
    ]),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
