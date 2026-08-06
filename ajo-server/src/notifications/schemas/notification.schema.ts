import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../../common/enums/notification.enum';

export type NotificationDocument = Notification & Document;

/**
 * A record of every notification sent (or attempted) to a user.
 * Serves two purposes:
 *   1. Delivery audit log — what was sent, via which channel, did it succeed?
 *   2. In-app notification inbox — the mobile app reads these for the
 *      notifications bell/list, using `isRead` to show unread counts.
 */
@Schema({ timestamps: true })
export class Notification {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: NotificationType, required: true, index: true })
  type!: NotificationType;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  /**
   * Structured payload so the mobile app can deep-link to the right
   * screen (e.g. { groupId, cycleId } for a contribution reminder).
   */
  @Prop({ type: Object })
  data?: Record<string, string>;

  @Prop({ type: String, enum: NotificationChannel, required: true })
  channel!: NotificationChannel;

  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  /** Provider error message, if delivery failed. */
  @Prop()
  failureReason?: string;

  @Prop({ default: false })
  isRead!: boolean;

  @Prop()
  readAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Index for the mobile notification inbox (newest-first per user)
NotificationSchema.index({ user: 1, createdAt: -1 });
// Index for efficient unread-count queries
NotificationSchema.index({ user: 1, isRead: 1 });
