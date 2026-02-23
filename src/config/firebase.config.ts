import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { validateConfig } from '../utils/validate-config';

class FirebaseConfigValidator {
  @IsString()
  @IsOptional()
  GOOGLE_APPLICATION_CREDENTIALS: string;

  @IsString()
  @IsOptional()
  FIREBASE_PROJECT_ID: string;

  @IsString()
  @IsOptional()
  FIREBASE_PRIVATE_KEY: string;

  @IsString()
  @IsOptional()
  FIREBASE_CLIENT_EMAIL: string;
}

export const firebaseConfig = registerAs('firebase', () => {
  validateConfig(process.env, FirebaseConfigValidator);

  return {
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };
});

export default firebaseConfig;
