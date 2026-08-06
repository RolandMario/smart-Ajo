"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStatus = exports.NotificationChannel = exports.NotificationType = void 0;
var NotificationType;
(function (NotificationType) {
    NotificationType["GROUP_INVITE_RECEIVED"] = "group_invite_received";
    NotificationType["GROUP_INVITE_ACCEPTED"] = "group_invite_accepted";
    NotificationType["GROUP_INVITE_DECLINED"] = "group_invite_declined";
    NotificationType["GROUP_ACTIVATED"] = "group_activated";
    NotificationType["GROUP_UPDATED"] = "group_updated";
    NotificationType["GROUP_CONTINUED"] = "group_continued";
    NotificationType["GROUP_TERMINATED"] = "group_terminated";
    NotificationType["ROTATION_ORDER_LOCKED"] = "rotation_order_locked";
    NotificationType["CONTRIBUTION_DUE_REMINDER"] = "contribution_due_reminder";
    NotificationType["CONTRIBUTION_DUE_URGENT"] = "contribution_due_urgent";
    NotificationType["CONTRIBUTION_DEBITED"] = "contribution_debited";
    NotificationType["CONTRIBUTION_FAILED_INSUFFICIENT"] = "contribution_failed_insufficient";
    NotificationType["CONTRIBUTION_DEFAULTED"] = "contribution_defaulted";
    NotificationType["PAYOUT_INITIATED"] = "payout_initiated";
    NotificationType["PAYOUT_SUCCESS"] = "payout_success";
    NotificationType["PAYOUT_FAILED"] = "payout_failed";
    NotificationType["PAYOUT_REVERSED"] = "payout_reversed";
    NotificationType["CYCLE_ADVANCED"] = "cycle_advanced";
    NotificationType["WALLET_FUNDED"] = "wallet_funded";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["PUSH"] = "push";
    NotificationChannel["SMS"] = "sms";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "pending";
    NotificationStatus["SENT"] = "sent";
    NotificationStatus["FAILED"] = "failed";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
//# sourceMappingURL=notification.enum.js.map