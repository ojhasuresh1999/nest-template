import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { FirebaseService } from '../helpers/firebase/firebase.service';

@Injectable()
export class FirebaseHealthIndicator extends HealthIndicator {
  constructor(private readonly firebase: FirebaseService) {
    super();
  }

  async isHealthy(key = 'firebase'): Promise<HealthIndicatorResult> {
    try {
      const ready = this.firebase.isReady();
      if (!ready) {
        throw new Error('Firebase Admin SDK not initialized');
      }
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Firebase health check failed',
        this.getStatus(key, false, { message: error?.message ?? 'Unknown' }),
      );
    }
  }
}
