import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function validateConfig<T extends object>(
  config: Record<string, unknown>,
  envVariablesClass: new () => T,
): T {
  const validatedConfig = plainToInstance(envVariablesClass, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation error:\n${errors
        .map((e) => JSON.stringify(e.constraints))
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
