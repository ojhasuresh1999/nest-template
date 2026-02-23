import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as firebaseAdmin from 'firebase-admin';
import { AllConfigType } from '../../../config/config.types';

export interface PushNotificationPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushNotificationResult {
  successCount: number;
  failureCount: number;
  failedTokens: string[];
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: firebaseAdmin.app.App | null = null;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    const firebaseConfig = this.configService.get('firebase', { infer: true });

    if (!firebaseConfig?.projectId || !firebaseConfig?.clientEmail || !firebaseConfig?.privateKey) {
      this.logger.warn('Firebase configuration is incomplete. Push notifications will not work.');
      return;
    }

    try {
      if (firebaseAdmin.apps.length === 0) {
        this.firebaseApp = firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId: firebaseConfig.projectId,
            clientEmail: firebaseConfig.clientEmail,
            privateKey: firebaseConfig.privateKey.replace(/\\n/g, '\n'),
          }),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.firebaseApp = firebaseAdmin.apps[0]!;
        this.logger.log('Using existing Firebase Admin SDK instance');
      }
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  /**
   * Check if Firebase is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.firebaseApp !== null;
  }

  /**
   * Get the Firebase messaging instance
   */
  getMessaging(): firebaseAdmin.messaging.Messaging | null {
    if (!this.isReady()) {
      this.logger.warn('Firebase not initialized, cannot get messaging instance');
      return null;
    }
    return this.firebaseApp!.messaging();
  }

  /**
   * Send push notification to multiple devices
   */
  async sendPushNotification(payload: PushNotificationPayload): Promise<PushNotificationResult> {
    const { tokens, title, body, data, imageUrl } = payload;

    if (!this.isReady()) {
      this.logger.warn('Firebase not initialized, skipping push notification');
      return { successCount: 0, failureCount: tokens.length, failedTokens: tokens };
    }

    if (tokens.length === 0) {
      this.logger.debug('No tokens provided, skipping push notification');
      return { successCount: 0, failureCount: 0, failedTokens: [] };
    }

    try {
      const message: firebaseAdmin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
          ...(imageUrl && { imageUrl }),
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.firebaseApp!.messaging().sendEachForMulticast(message);

      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          if (resp.error) {
            this.logger.debug(
              `Token ${tokens[idx].substring(0, 20)}... failed: ${resp.error.code}`,
            );
          }
        }
      });

      if (response.failureCount > 0) {
        this.logger.warn(
          `Push notification: ${response.successCount} succeeded, ${response.failureCount} failed`,
        );
      } else {
        this.logger.log(`Push notification sent successfully to ${response.successCount} devices`);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        failedTokens,
      };
    } catch (error) {
      this.logger.error('Failed to send push notification', error);
      return { successCount: 0, failureCount: tokens.length, failedTokens: tokens };
    }
  }

  /**
   * Send push notification to a single device
   */
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    const result = await this.sendPushNotification({ tokens: [token], title, body, data });
    return result.successCount > 0;
  }
}
