import { registerAs } from '@nestjs/config';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { validateConfig } from 'src/utils/validate-config';

export interface SocketConfig {
  pingInterval: number;
  pingTimeout: number;
  maxPayloadSize: number;
}

class SocketEnvironmentVariablesValidator {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  SOCKET_PING_INTERVAL: number = 25000;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  SOCKET_PING_TIMEOUT: number = 30000;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1024)
  @IsOptional()
  SOCKET_MAX_PAYLOAD: number = 1048576; // 1MB
}

export const socketConfig = registerAs<SocketConfig>('socket', () => {
  const validatedConfig = validateConfig(process.env, SocketEnvironmentVariablesValidator);

  return {
    pingInterval: validatedConfig.SOCKET_PING_INTERVAL,
    pingTimeout: validatedConfig.SOCKET_PING_TIMEOUT,
    maxPayloadSize: validatedConfig.SOCKET_MAX_PAYLOAD,
  };
});

export default socketConfig;
