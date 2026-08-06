import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DeviceToken,
  DeviceTokenDocument,
} from './schemas/device-token.schema';

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectModel(DeviceToken.name)
    private deviceTokenModel: Model<DeviceTokenDocument>,
  ) {}

  /**
   * Registers a new FCM token for a user, or re-activates it if it was
   * previously deactivated. If the token already belongs to a different
   * user, it is moved to this user (the previous owner logged out /
   * shared a device).
   */
  async register(
    userId: string,
    token: string,
    platform?: string,
  ): Promise<void> {
    await this.deviceTokenModel.findOneAndUpdate(
      { token },
      { user: new Types.ObjectId(userId), token, platform, isActive: true },
      { upsert: true, new: true },
    );
  }

  /**
   * Deactivates a token (e.g. user explicitly logs out). Does not delete
   * the document so we keep the audit trail.
   */
  async deactivate(token: string): Promise<void> {
    await this.deviceTokenModel.updateOne(
      { token },
      { $set: { isActive: false } },
    );
  }

  /**
   * Returns all active FCM tokens for a user.
   */
  async getActiveTokens(userId: string): Promise<string[]> {
    const docs = await this.deviceTokenModel
      .find({ user: new Types.ObjectId(userId), isActive: true })
      .select('token')
      .lean();

    return docs.map((d) => d.token);
  }

  /**
   * Returns all active FCM tokens for multiple users at once — used when
   * broadcasting to a whole group.
   */
  async getActiveTokensForUsers(
    userIds: string[],
  ): Promise<Map<string, string[]>> {
    const objectIds = userIds.map((id) => new Types.ObjectId(id));
    const docs = await this.deviceTokenModel
      .find({ user: { $in: objectIds }, isActive: true })
      .select('user token')
      .lean();

    const map = new Map<string, string[]>();
    for (const doc of docs) {
      const uid = doc.user.toString();
      const existing = map.get(uid) ?? [];
      existing.push(doc.token);
      map.set(uid, existing);
    }
    return map;
  }

  /**
   * Deletes stale tokens reported as invalid by FCM.
   */
  async removeStaleTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.deviceTokenModel.deleteMany({ token: { $in: tokens } });
  }
}
