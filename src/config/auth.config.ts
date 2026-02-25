import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsInt, Min, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { AuthConfig } from './config.types';
import { validateConfig } from 'src/utils/validate-config';

class AuthEnvironmentVariablesValidator {
  @IsString()
  JWT_SECRET: string = 'default-jwt-secret-change-in-production-32-chars';

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  JWT_REFRESH_SECRET: string = 'default-refresh-secret-change-in-production-32';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION_SHORT: string = '1d';

  @IsString()
  @IsOptional()
  JWT_REMEMBER_ME_EXPIRATION: string = '30d';

  @IsInt()
  @IsPositive()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  MAX_LOGIN_ATTEMPTS: number = 5;

  @IsInt()
  @IsPositive()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  LOCKOUT_DURATION_MINUTES: number = 15;

  @IsInt()
  @IsPositive()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  MAX_SESSIONS_PER_USER: number = 5;
}

export const authConfig = registerAs<AuthConfig>('auth', () => {
  const validatedConfig = validateConfig(process.env, AuthEnvironmentVariablesValidator);

  return {
    jwtSecret: validatedConfig.JWT_SECRET,
    jwtAccessExpiration: validatedConfig.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshSecret: validatedConfig.JWT_REFRESH_SECRET,
    jwtRefreshExpiration: validatedConfig.JWT_REFRESH_EXPIRATION,
    jwtRefreshExpirationShort: validatedConfig.JWT_REFRESH_EXPIRATION_SHORT,
    jwtRememberMeExpiration: validatedConfig.JWT_REMEMBER_ME_EXPIRATION,
    maxLoginAttempts: validatedConfig.MAX_LOGIN_ATTEMPTS,
    lockoutDurationMinutes: validatedConfig.LOCKOUT_DURATION_MINUTES,
    maxSessionsPerUser: validatedConfig.MAX_SESSIONS_PER_USER,
  };
});

export default authConfig;
