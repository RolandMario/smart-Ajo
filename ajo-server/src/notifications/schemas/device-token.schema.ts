import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DeviceTokenDocument = DeviceToken & Document;

/**
 * An FCM device token registered by a user's mobile app.
 * A user can have multiple tokens (phone + tablet, or multiple installs).
 * Tokens become stale when the app is uninstalled — FCM returns
 * `messaging/registration-token-not-registered` and we delete them then.
 */
@Schema({ timestamps: true })
export class DeviceToken {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true })
  token!: string;

  /** 'ios' | 'android' — for future per-platform targeting if needed. */
  @Prop({ trim: true })
  platform?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);

// One token string is unique globally — a token can only belong to one
// user at a time (re-registering a token on a new account deactivates it
// on the old one via upsert logic in DeviceTokenService).
DeviceTokenSchema.index({ token: 1 }, { unique: true });
