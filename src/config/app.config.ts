import { registerAs } from '@nestjs/config';
import { IsEnum, IsInt, IsOptional, IsString, Max, IsPositive, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { AppConfig } from './config.types';
import { validateConfig } from 'src/utils/validate-config';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Production;

  @IsString()
  @IsOptional()
  PROJECT_NAME = 'Nest-App';

  @IsString()
  @IsOptional()
  APP_NAME = 'backend-api';

  @IsString()
  @IsOptional()
  HOST = 'localhost';

  @IsInt()
  @IsPositive()
  @Min(1025)
  @Max(65535)
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  NODE_PORT = 3000;

  @IsInt()
  @IsPositive()
  @Min(1025)
  @Max(65535)
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  PORT = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX = 'api';

  @IsString()
  @IsOptional()
  WORKING_DIRECTORY = process.cwd();
}

export const appConfig = registerAs<AppConfig>('app', () => {
  const validatedConfig = validateConfig(process.env, EnvironmentVariablesValidator);

  let port = validatedConfig.PORT;
  if (process.env['PORT']) {
    port = validatedConfig.PORT;
  } else if (process.env['NODE_PORT']) {
    port = validatedConfig.NODE_PORT;
  }

  return {
    workingDirectory: validatedConfig.WORKING_DIRECTORY || process.cwd(),
    project: validatedConfig.PROJECT_NAME || 'Nest-App',
    env: validatedConfig.NODE_ENV || Environment.Production,
    name: validatedConfig.APP_NAME || 'backend-api',
    host: validatedConfig.HOST || 'localhost',
    port,
    apiPrefix: validatedConfig.API_PREFIX || 'api',
  };
});

export default appConfig;
