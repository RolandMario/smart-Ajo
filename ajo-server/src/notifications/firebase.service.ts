import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  token: string;
  success: boolean;
  /** Set when FCM tells us the token is no longer valid — caller should delete it. */
  tokenInvalid?: boolean;
  error?: string;
}

/**
 * Thin wrapper around the Firebase Admin SDK (modular API, v9+) for
 * sending FCM push notifications. Initialised once on module startup
 * using service account credentials from environment variables.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured — push notifications will be skipped. ' +
          'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env',
      );
      return;
    }

    try {
      this.app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
      this.logger.log(`Firebase Admin initialised (project: ${projectId})`);
    } catch (error) {
      this.logger.error(
        `Failed to initialise Firebase Admin: ${String(error)}`,
      );
    }
  }

  get isReady(): boolean {
    return !!this.app;
  }

  /**
   * Sends a push notification to a single FCM token.
   * Never throws — failures are captured in the returned PushResult.
   */
  async sendToToken(token: string, payload: PushPayload): Promise<PushResult> {
    if (!this.app) {
      return { token, success: false, error: 'Firebase not initialised' };
    }

    try {
      await getMessaging(this.app).send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });

      return { token, success: true };
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      const isInvalid =
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token';

      return {
        token,
        success: false,
        tokenInvalid: isInvalid,
        error: code || String(error),
      };
    }
  }

  /**
   * Sends the same notification to multiple tokens, handling partial
   * failures. Returns each token's result.
   */
  async sendToTokens(
    tokens: string[],
    payload: PushPayload,
  ): Promise<PushResult[]> {
    if (tokens.length === 0) return [];
    return Promise.all(tokens.map((t) => this.sendToToken(t, payload)));
  }
}
