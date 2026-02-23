export type AppConfig = {
  workingDirectory: string;
  project: string;
  env: string;
  name: string;
  host: string;
  port: number;
  apiPrefix: string;
};

export type DatabaseConfig = {
  uri: string;
  database: string;
};

export type AuthConfig = {
  jwtSecret: string;
  jwtAccessExpiration: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiration: string;
  jwtRefreshExpirationShort: string;
  jwtRememberMeExpiration: string;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  maxSessionsPerUser: number;
};

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type RedisConfig = {
  host: string;
  port: number;
  password: string;
  db: number;
};
export type S3Config = {
  awsRegion: string;
  awsS3Bucket: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsDomainUrl: string;
};

export type SocketConfig = {
  pingInterval: number;
  pingTimeout: number;
  maxPayloadSize: number;
};

export type FirebaseConfig = {
  credentials?: string;
  projectId?: string;
  privateKey?: string;
  clientEmail?: string;
};

export type AllConfigType = {
  app: AppConfig;
  db: DatabaseConfig;
  auth: AuthConfig;
  mail: MailConfig;
  redis: RedisConfig;
  s3: S3Config;
  socket: SocketConfig;
  firebase: FirebaseConfig;
};
