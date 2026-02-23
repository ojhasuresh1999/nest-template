import { registerAs } from '@nestjs/config';
import { IsString } from 'class-validator';
import { validateConfig } from 'src/utils/validate-config';

class S3EnvironmentVariablesValidator {
  @IsString()
  AWS_REGION: string;

  @IsString()
  AWS_S3_BUCKET: string;

  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_DOMAIN_URL: string;
}

export const s3Config = registerAs('s3', () => {
  const validatedConfig = validateConfig(process.env, S3EnvironmentVariablesValidator);

  return {
    awsRegion: validatedConfig.AWS_REGION,
    awsS3Bucket: validatedConfig.AWS_S3_BUCKET,
    awsAccessKeyId: validatedConfig.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: validatedConfig.AWS_SECRET_ACCESS_KEY,
    awsDomainUrl: validatedConfig.AWS_DOMAIN_URL,
  };
});

export default s3Config;
