import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { SystemLog, SystemLogSchema } from './schemas/system-log.schema';
import { SystemLogRepository } from './repositories/system-log.repository';
import { SystemLogService } from './system-log.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: SystemLog.name, schema: SystemLogSchema }]),
  ],
  providers: [SystemLogService, SystemLogRepository],
  exports: [SystemLogService],
})
export class SystemLogModule {}
