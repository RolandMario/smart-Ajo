"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const notification_schema_1 = require("./schemas/notification.schema");
const firebase_service_1 = require("./firebase.service");
const device_token_service_1 = require("./device-token.service");
const termii_service_1 = require("../otp/termii.service");
const notification_enum_1 = require("../common/enums/notification.enum");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    notificationModel;
    firebaseService;
    deviceTokenService;
    termiiService;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(notificationModel, firebaseService, deviceTokenService, termiiService) {
        this.notificationModel = notificationModel;
        this.firebaseService = firebaseService;
        this.deviceTokenService = deviceTokenService;
        this.termiiService = termiiService;
    }
    async send(params) {
        await Promise.all([
            this.sendPush(params),
            params.smsEnabled ? this.sendSms(params) : Promise.resolve(),
        ]);
    }
    async sendPush(params) {
        const tokenMap = await this.deviceTokenService.getActiveTokensForUsers(params.userIds);
        const staleTokens = [];
        await Promise.all(params.userIds.map(async (userId) => {
            const tokens = tokenMap.get(userId) ?? [];
            const notif = await this.notificationModel.create({
                user: new mongoose_2.Types.ObjectId(userId),
                type: params.type,
                title: params.title,
                body: params.body,
                data: params.data,
                channel: notification_enum_1.NotificationChannel.PUSH,
                status: tokens.length === 0
                    ? notification_enum_1.NotificationStatus.FAILED
                    : notification_enum_1.NotificationStatus.PENDING,
                failureReason: tokens.length === 0 ? 'No registered device tokens' : undefined,
            });
            if (tokens.length === 0)
                return;
            const results = await this.firebaseService.sendToTokens(tokens, {
                title: params.title,
                body: params.body,
                data: { ...params.data, notificationId: notif._id.toString() },
            });
            const anySuccess = results.some((r) => r.success);
            staleTokens.push(...results.filter((r) => r.tokenInvalid).map((r) => r.token));
            notif.status = anySuccess
                ? notification_enum_1.NotificationStatus.SENT
                : notification_enum_1.NotificationStatus.FAILED;
            if (!anySuccess) {
                notif.failureReason = results[0]?.error ?? 'All tokens failed';
            }
            await notif.save();
        }));
        if (staleTokens.length > 0) {
            await this.deviceTokenService.removeStaleTokens(staleTokens);
            this.logger.log(`Removed ${staleTokens.length} stale FCM token(s)`);
        }
    }
    async sendSms(params) {
        if (!params.phones || params.phones.size === 0)
            return;
        await Promise.all(params.userIds.map(async (userId) => {
            const phone = params.phones?.get(userId);
            if (!phone)
                return;
            let status = notification_enum_1.NotificationStatus.SENT;
            let failureReason;
            try {
                await this.termiiService.sendSms(phone, `${params.title}: ${params.body}`);
            }
            catch (err) {
                status = notification_enum_1.NotificationStatus.FAILED;
                failureReason = String(err);
                this.logger.warn(`SMS to ${phone} failed: ${failureReason}`);
            }
            await this.notificationModel.create({
                user: new mongoose_2.Types.ObjectId(userId),
                type: params.type,
                title: params.title,
                body: params.body,
                data: params.data,
                channel: notification_enum_1.NotificationChannel.SMS,
                status,
                failureReason,
            });
        }));
    }
    async listForUser(userId, opts = {}) {
        const { limit = 20, skip = 0 } = opts;
        const [notifications, unreadCount] = await Promise.all([
            this.notificationModel
                .find({
                user: new mongoose_2.Types.ObjectId(userId),
                channel: notification_enum_1.NotificationChannel.PUSH,
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.notificationModel.countDocuments({
                user: new mongoose_2.Types.ObjectId(userId),
                channel: notification_enum_1.NotificationChannel.PUSH,
                isRead: false,
            }),
        ]);
        return { notifications, unreadCount };
    }
    async markRead(userId, notificationIds) {
        await this.notificationModel.updateMany({
            _id: { $in: notificationIds.map((id) => new mongoose_2.Types.ObjectId(id)) },
            user: new mongoose_2.Types.ObjectId(userId),
            isRead: false,
        }, { $set: { isRead: true, readAt: new Date() } });
    }
    async markAllRead(userId) {
        await this.notificationModel.updateMany({ user: new mongoose_2.Types.ObjectId(userId), isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(notification_schema_1.Notification.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        firebase_service_1.FirebaseService,
        device_token_service_1.DeviceTokenService,
        termii_service_1.TermiiService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map