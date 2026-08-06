import { Model } from 'mongoose';
import { DeviceTokenDocument } from './schemas/device-token.schema';
export declare class DeviceTokenService {
    private deviceTokenModel;
    constructor(deviceTokenModel: Model<DeviceTokenDocument>);
    register(userId: string, token: string, platform?: string): Promise<void>;
    deactivate(token: string): Promise<void>;
    getActiveTokens(userId: string): Promise<string[]>;
    getActiveTokensForUsers(userIds: string[]): Promise<Map<string, string[]>>;
    removeStaleTokens(tokens: string[]): Promise<void>;
}
