import { registerAs } from '@nestjs/config';
import { IsString, IsUrl } from 'class-validator';
import { DatabaseConfig } from './config.types';
import { validateConfig } from 'src/utils/validate-config';

class EnvironmentVariablesValidator {
  @IsUrl({ protocols: ['https', 'mongodb', 'mongodb+srv'], require_tld: false })
  MONGO_URI!: string;

  @IsString()
  DB_DATABASE!: string;
}

export const dbConfig = registerAs<DatabaseConfig>('db', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    uri: process.env['MONGO_URI'] || 'mongodb://localhost:27017',
    database: process.env['DB_DATABASE'] || 'wtsNestSetup',
  };
});

export default dbConfig;
