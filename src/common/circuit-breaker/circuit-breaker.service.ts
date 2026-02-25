import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CircuitBreakerConfig {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  volumeThreshold: 5,
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  create<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    config?: CircuitBreakerConfig,
  ): CircuitBreaker<any[], T> {
    if (this.breakers.has(name)) {
      return this.breakers.get(name) as CircuitBreaker<any[], T>;
    }

    const opts = { ...DEFAULT_CONFIG, ...config, name };
    const breaker = new CircuitBreaker(fn, opts);

    breaker.on('open', () => this.logger.warn(`[${name}] Circuit OPEN — requests will fail fast`));
    breaker.on('halfOpen', () => this.logger.log(`[${name}] Circuit HALF-OPEN — testing recovery`));
    breaker.on('close', () => this.logger.log(`[${name}] Circuit CLOSED — service recovered`));
    breaker.on('fallback', () => this.logger.debug(`[${name}] Fallback triggered`));

    this.breakers.set(name, breaker);
    return breaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getStats(name: string) {
    const breaker = this.breakers.get(name);
    if (!breaker) return null;
    return breaker.stats;
  }
}
