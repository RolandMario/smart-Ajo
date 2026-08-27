export declare enum NotificationType {
    GROUP_INVITE_RECEIVED = "group_invite_received",
    GROUP_INVITE_ACCEPTED = "group_invite_accepted",
    GROUP_INVITE_DECLINED = "group_invite_declined",
    GROUP_ACTIVATED = "group_activated",
    GROUP_UPDATED = "group_updated",
    GROUP_CONTINUED = "group_continued",
    GROUP_TERMINATED = "group_terminated",
    ROTATION_ORDER_LOCKED = "rotation_order_locked",
    CONTRIBUTION_DUE_REMINDER = "contribution_due_reminder",
    CONTRIBUTION_DUE_URGENT = "contribution_due_urgent",
    CONTRIBUTION_DEBITED = "contribution_debited",
    CONTRIBUTION_FAILED_INSUFFICIENT = "contribution_failed_insufficient",
    CONTRIBUTION_DEFAULTED = "contribution_defaulted",
    PAYOUT_INITIATED = "payout_initiated",
    PAYOUT_SUCCESS = "payout_success",
    PAYOUT_FAILED = "payout_failed",
    PAYOUT_REVERSED = "payout_reversed",
    CYCLE_ADVANCED = "cycle_advanced",
    WALLET_FUNDED = "wallet_funded",
    SAVING_CREATED = "saving_created",
    SAVING_DEBITED = "saving_debited",
    SAVING_INSUFFICIENT = "saving_insufficient",
    SAVING_COMPLETED = "saving_completed",
    SAVING_WITHDRAWN = "saving_withdrawn"
}
export declare enum NotificationChannel {
    PUSH = "push",
    SMS = "sms"
}
export declare enum NotificationStatus {
    PENDING = "pending",
    SENT = "sent",
    FAILED = "failed"
}
