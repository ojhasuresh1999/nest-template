import { Module, Global, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.types';
import { BullModule } from '@nestjs/bullmq';
import { ModuleRef } from '@nestjs/core';
import { Worker } from 'bullmq';

import { Queues } from './queue.constants';
import { QueueService } from './queue.service';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { MailHelper } from 'src/common/helpers/mail/mail.helper';

/**
 * Global Queue Module
 * Provides BullMQ-based background job processing infrastructure
 *
 * Features:
 * - Type-safe job dispatching
 * - Email, SMS, and Notification queues
 * - Automatic retry with exponential backoff
 * - Rate limiting per queue
 * - Graceful shutdown handling
 */
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        connection: {
          host: configService.getOrThrow('redis.host', { infer: true }) || 'localhost',
          port: configService.getOrThrow('redis.port', { infer: true }) || 6379,
          password: configService.getOrThrow('redis.password', { infer: true }) || '',
          db: configService.getOrThrow('redis.db', { infer: true }) || 0,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullModule.registerQueue({
      name: Queues.QUEUE__EMAIL.name,
      defaultJobOptions: Queues.QUEUE__EMAIL.options.defaultJobOptions,
    }),
    BullBoardModule.forFeature({
      name: Queues.QUEUE__EMAIL.name,
      adapter: BullMQAdapter,
    }),

    BullModule.registerQueue({
      name: Queues.QUEUE__SMS.name,
      defaultJobOptions: Queues.QUEUE__SMS.options.defaultJobOptions,
    }),
    BullBoardModule.forFeature({
      name: Queues.QUEUE__SMS.name,
      adapter: BullMQAdapter,
    }),
    BullModule.registerQueue({
      name: Queues.QUEUE__NOTIFICATION.name,
      defaultJobOptions: Queues.QUEUE__NOTIFICATION.options.defaultJobOptions,
    }),
    BullBoardModule.forFeature({
      name: Queues.QUEUE__NOTIFICATION.name,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [QueueService, EmailProcessor, SmsProcessor, NotificationProcessor, MailHelper],
  exports: [QueueService, BullModule],
})
export class QueueModule implements OnApplicationShutdown {
  private static readonly SHUTDOWN_TIMEOUT = 15000;

  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(signal?: string) {
    console.log(`🔄 Queue module shutting down (signal: ${signal})`);

    const processors = [
      this.moduleRef.get(EmailProcessor, { strict: false }),
      this.moduleRef.get(SmsProcessor, { strict: false }),
      this.moduleRef.get(NotificationProcessor, { strict: false }),
    ];

    const closePromises = processors
      .filter((p) => p?.worker)
      .map((p) => {
        const worker = p.worker as Worker;
        return worker
          .close(true)
          .then(() => console.log(`✅ Worker [${worker.name}] closed`))
          .catch((err) => console.error(`❌ Worker [${worker.name}] close error:`, err));
      });

    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn('⚠️ Queue shutdown timed out, forcing exit');
        resolve();
      }, QueueModule.SHUTDOWN_TIMEOUT),
    );

    await Promise.race([Promise.allSettled(closePromises), timeout]);
    console.log('✅ Queue shutdown complete');
  }
}
