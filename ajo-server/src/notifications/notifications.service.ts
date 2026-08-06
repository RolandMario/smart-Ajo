import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { FirebaseService } from './firebase.service';
import { DeviceTokenService } from './device-token.service';
import { TermiiService } from '../otp/termii.service';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../common/enums/notification.enum';

export interface SendNotificationParams {
  /** Target user(s). Pass multiple for group-wide broadcasts. */
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  /**
   * Optional deep-link data for the mobile app. All values must be
   * strings (FCM data payload requirement).
   */
  data?: Record<string, string>;
  /**
   * When true, also sends an SMS via Termii in addition to push.
   * Use for high-importance events (invite, payout) where the user might
   * not have push notifications enabled.
   */
  smsEnabled?: boolean;
  /**
   * Map of userId -> phone number, required when smsEnabled is true.
   * Callers are responsible for fetching these — NotificationsService
   * has no direct dependency on UsersService to keep it lean.
   */
  phones?: Map<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private firebaseService: FirebaseService,
    private deviceTokenService: DeviceTokenService,
    private termiiService: TermiiService,
  ) {}

  // ---- Core send -------------------------------------------------------------

  /**
   * Send a notification to one or more users via push (always attempted)
   * and optionally SMS. Persists a Notification document per user per
   * channel — these power the in-app notification inbox.
   *
   * Never throws — delivery failures are recorded on the Notification
   * document and logged, but never bubble up to the caller.
   */
  async send(params: SendNotificationParams): Promise<void> {
    await Promise.all([
      this.sendPush(params),
      params.smsEnabled ? this.sendSms(params) : Promise.resolve(),
    ]);
  }

  private async sendPush(params: SendNotificationParams): Promise<void> {
    const tokenMap = await this.deviceTokenService.getActiveTokensForUsers(
      params.userIds,
    );
    const staleTokens: string[] = [];

    await Promise.all(
      params.userIds.map(async (userId) => {
        const tokens = tokenMap.get(userId) ?? [];

        // Always persist the Notification even if the user has no tokens —
        // it still appears in their in-app inbox.
        const notif = await this.notificationModel.create({
          user: new Types.ObjectId(userId),
          type: params.type,
          title: params.title,
          body: params.body,
          data: params.data,
          channel: NotificationChannel.PUSH,
          status:
            tokens.length === 0
              ? NotificationStatus.FAILED
              : NotificationStatus.PENDING,
          failureReason:
            tokens.length === 0 ? 'No registered device tokens' : undefined,
        });

        if (tokens.length === 0) return;

        const results = await this.firebaseService.sendToTokens(tokens, {
          title: params.title,
          body: params.body,
          data: { ...params.data, notificationId: notif._id.toString() },
        });

        const anySuccess = results.some((r) => r.success);
        staleTokens.push(
          ...results.filter((r) => r.tokenInvalid).map((r) => r.token),
        );

        notif.status = anySuccess
          ? NotificationStatus.SENT
          : NotificationStatus.FAILED;
        if (!anySuccess) {
          notif.failureReason = results[0]?.error ?? 'All tokens failed';
        }
        await notif.save();
      }),
    );

    if (staleTokens.length > 0) {
      await this.deviceTokenService.removeStaleTokens(staleTokens);
      this.logger.log(`Removed ${staleTokens.length} stale FCM token(s)`);
    }
  }

  private async sendSms(params: SendNotificationParams): Promise<void> {
    if (!params.phones || params.phones.size === 0) return;

    await Promise.all(
      params.userIds.map(async (userId) => {
        const phone = params.phones?.get(userId);
        if (!phone) return;

        let status = NotificationStatus.SENT;
        let failureReason: string | undefined;

        try {
          await this.termiiService.sendSms(
            phone,
            `${params.title}: ${params.body}`,
          );
        } catch (err) {
          status = NotificationStatus.FAILED;
          failureReason = String(err);
          this.logger.warn(`SMS to ${phone} failed: ${failureReason}`);
        }

        await this.notificationModel.create({
          user: new Types.ObjectId(userId),
          type: params.type,
          title: params.title,
          body: params.body,
          data: params.data,
          channel: NotificationChannel.SMS,
          status,
          failureReason,
        });
      }),
    );
  }

  // ---- Inbox (mobile app) ----------------------------------------------------

  async listForUser(
    userId: string,
    opts: { limit?: number; skip?: number } = {},
  ) {
    const { limit = 20, skip = 0 } = opts;

    const [notifications, unreadCount] = await Promise.all([
      this.notificationModel
        .find({
          user: new Types.ObjectId(userId),
          channel: NotificationChannel.PUSH,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments({
        user: new Types.ObjectId(userId),
        channel: NotificationChannel.PUSH,
        isRead: false,
      }),
    ]);

    return { notifications, unreadCount };
  }

  async markRead(userId: string, notificationIds: string[]): Promise<void> {
    await this.notificationModel.updateMany(
      {
        _id: { $in: notificationIds.map((id) => new Types.ObjectId(id)) },
        user: new Types.ObjectId(userId),
        isRead: false,
      },
      { $set: { isRead: true, readAt: new Date() } },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { user: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
  }
}
