import { registerAs } from '@nestjs/config';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { validateConfig } from 'src/utils/validate-config';

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
}

class RedisEnvironmentVariablesValidator {
  @IsString()
  REDIS_HOST: string = 'localhost';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsPositive()
  @Min(1025)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD: string = '';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(16)
  @IsOptional()
  REDIS_DB: number = 0;
}

export const redisConfig = registerAs<RedisConfig>('redis', () => {
  const validatedConfig = validateConfig(process.env, RedisEnvironmentVariablesValidator);

  return {
    host: validatedConfig.REDIS_HOST,
    port: validatedConfig.REDIS_PORT,
    password: validatedConfig.REDIS_PASSWORD,
    db: validatedConfig.REDIS_DB,
  };
});

export default redisConfig;
