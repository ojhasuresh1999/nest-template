import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { SystemLogRepository } from './repositories/system-log.repository';
import { SystemLog } from './schemas/system-log.schema';

@Injectable()
export class SystemLogService {
  private readonly logger = new Logger(SystemLogService.name);
  private readonly logDir = process.env['LOG_DIR'] || 'logs';
  private readonly BATCH_SIZE = 1000;

  constructor(private readonly systemLogRepository: SystemLogRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyLogSync(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = this.formatDate(yesterday);

    this.logger.log(`Starting daily log sync for date: ${dateStr}`);

    const filesToProcess = [
      { path: path.join(this.logDir, `app-${dateStr}.log`), source: 'app' },
      { path: path.join(this.logDir, `error-${dateStr}.log`), source: 'error' },
    ];

    let totalInserted = 0;

    for (const file of filesToProcess) {
      if (!fs.existsSync(file.path)) {
        this.logger.log(`No log file found: ${file.path}, skipping.`);
        continue;
      }

      try {
        const count = await this.processLogFile(file.path, file.source);
        totalInserted += count;
        fs.unlinkSync(file.path);
        this.logger.log(`Processed and deleted: ${file.path} (${count} entries)`);
      } catch (error) {
        this.logger.error(
          `Failed to process log file: ${file.path}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    this.logger.log(`Daily log sync completed. Total entries inserted: ${totalInserted}`);
  }

  async syncByDate(dateStr: string): Promise<{ totalInserted: number }> {
    const filesToProcess = [
      { path: path.join(this.logDir, `app-${dateStr}.log`), source: 'app' },
      { path: path.join(this.logDir, `error-${dateStr}.log`), source: 'error' },
    ];

    let totalInserted = 0;

    for (const file of filesToProcess) {
      if (!fs.existsSync(file.path)) {
        this.logger.log(`No log file found: ${file.path}, skipping.`);
        continue;
      }

      const count = await this.processLogFile(file.path, file.source);
      totalInserted += count;
      fs.unlinkSync(file.path);
      this.logger.log(`Processed and deleted: ${file.path} (${count} entries)`);
    }

    return { totalInserted };
  }

  private async processLogFile(filePath: string, source: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      let batch: Partial<SystemLog>[] = [];
      let totalInserted = 0;

      rl.on('line', async (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const parsed = JSON.parse(trimmed);
          batch.push(this.mapToLogEntry(parsed, source));

          if (batch.length >= this.BATCH_SIZE) {
            rl.pause();
            const currentBatch = [...batch];
            batch = [];
            try {
              const count = await this.systemLogRepository.insertBatch(currentBatch);
              totalInserted += count;
            } catch (err) {
              this.logger.error('Batch insert failed', err instanceof Error ? err.stack : err);
            }
            rl.resume();
          }
        } catch {
          batch.push({
            level: 'info',
            message: trimmed,
            source,
            timestamp: new Date(),
            context: 'raw',
            meta: {},
          });
        }
      });

      rl.on('close', async () => {
        try {
          if (batch.length > 0) {
            const count = await this.systemLogRepository.insertBatch(batch);
            totalInserted += count;
          }
          resolve(totalInserted);
        } catch (err) {
          reject(err);
        }
      });

      rl.on('error', reject);
      stream.on('error', reject);
    });
  }

  private mapToLogEntry(parsed: Record<string, any>, source: string): Partial<SystemLog> {
    return {
      level: parsed.level || 'info',
      message: parsed.message || '',
      context: parsed.context || parsed.service || '',
      timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
      source,
      meta: this.extractMeta(parsed),
    };
  }

  private extractMeta(parsed: Record<string, any>): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { level, message, context, timestamp, service, ...rest } = parsed;
    return rest;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
