"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const notification_schema_1 = require("./schemas/notification.schema");
const device_token_schema_1 = require("./schemas/device-token.schema");
const notifications_service_1 = require("./notifications.service");
const notifications_controller_1 = require("./notifications.controller");
const firebase_service_1 = require("./firebase.service");
const device_token_service_1 = require("./device-token.service");
const reminder_scheduler_1 = require("./reminder.scheduler");
const defaulter_scheduler_1 = require("./defaulter.scheduler");
const auto_collect_scheduler_1 = require("./auto-collect.scheduler");
const otp_module_1 = require("../otp/otp.module");
const users_module_1 = require("../users/users.module");
const groups_module_1 = require("../groups/groups.module");
const cycles_module_1 = require("../cycles/cycles.module");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: notification_schema_1.Notification.name, schema: notification_schema_1.NotificationSchema },
                { name: device_token_schema_1.DeviceToken.name, schema: device_token_schema_1.DeviceTokenSchema },
            ]),
            otp_module_1.OtpModule,
            users_module_1.UsersModule,
            (0, common_1.forwardRef)(() => groups_module_1.GroupsModule),
            (0, common_1.forwardRef)(() => cycles_module_1.CyclesModule),
        ],
        controllers: [notifications_controller_1.NotificationsController],
        providers: [
            notifications_service_1.NotificationsService,
            firebase_service_1.FirebaseService,
            device_token_service_1.DeviceTokenService,
            reminder_scheduler_1.ReminderScheduler,
            defaulter_scheduler_1.DefaulterScheduler,
            auto_collect_scheduler_1.AutoCollectScheduler,
        ],
        exports: [notifications_service_1.NotificationsService],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map