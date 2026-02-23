import { registerAs } from '@nestjs/config';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { validateConfig } from 'src/utils/validate-config';
import { MailConfig } from './config.types';

class MailEnvironmentVariablesValidator {
  @IsString()
  MAIL_HOST: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  MAIL_PORT: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  MAIL_ENCRYPTION: boolean;

  @IsString()
  MAIL_USERNAME: string;

  @IsString()
  MAIL_PASSWORD: string;

  @IsString()
  MAIL_FROM: string;
}

export const mailConfig = registerAs<MailConfig>('mail', () => {
  const validatedConfig = validateConfig(process.env, MailEnvironmentVariablesValidator);

  return {
    host: validatedConfig.MAIL_HOST || 'smtp.gmail.com',
    port: validatedConfig.MAIL_PORT || 587,
    secure: validatedConfig.MAIL_ENCRYPTION || false,
    user: validatedConfig.MAIL_USERNAME || '',
    pass: validatedConfig.MAIL_PASSWORD || '',
    from: validatedConfig.MAIL_FROM || 'noreply@shubhavivah.com',
  };
});

export default mailConfig;
