import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { FirebaseService } from './firebase.service';
import { DeviceTokenService } from './device-token.service';
import { TermiiService } from '../otp/termii.service';
import { NotificationType } from '../common/enums/notification.enum';
export interface SendNotificationParams {
    userIds: string[];
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, string>;
    smsEnabled?: boolean;
    phones?: Map<string, string>;
}
export declare class NotificationsService {
    private notificationModel;
    private firebaseService;
    private deviceTokenService;
    private termiiService;
    private readonly logger;
    constructor(notificationModel: Model<NotificationDocument>, firebaseService: FirebaseService, deviceTokenService: DeviceTokenService, termiiService: TermiiService);
    send(params: SendNotificationParams): Promise<void>;
    private sendPush;
    private sendSms;
    listForUser(userId: string, opts?: {
        limit?: number;
        skip?: number;
    }): Promise<{
        notifications: (Notification & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        unreadCount: number;
    }>;
    markRead(userId: string, notificationIds: string[]): Promise<void>;
    markAllRead(userId: string): Promise<void>;
}
