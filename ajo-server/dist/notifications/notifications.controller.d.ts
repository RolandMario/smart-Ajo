import { NotificationsService } from './notifications.service';
import { DeviceTokenService } from './device-token.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class NotificationsController {
    private notificationsService;
    private deviceTokenService;
    constructor(notificationsService: NotificationsService, deviceTokenService: DeviceTokenService);
    list(user: RequestUser, limit?: string, skip?: string): Promise<{
        notifications: (import("./schemas/notification.schema").Notification & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        unreadCount: number;
    }>;
    markRead(user: RequestUser, dto: MarkReadDto): Promise<void>;
    markAllRead(user: RequestUser): Promise<void>;
    registerToken(user: RequestUser, dto: RegisterDeviceTokenDto): Promise<void>;
    deactivateToken(token: string): Promise<void>;
}
