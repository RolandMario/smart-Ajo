"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationEvents = void 0;
const notification_enum_1 = require("../common/enums/notification.enum");
exports.NotificationEvents = {
    billPaymentSuccess(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.WALLET_FUNDED,
            title: 'Bill Payment Successful',
            body: `Your ${params.serviceType} payment of \u20A6${params.amount} to ${params.recipient} was successful.`,
            smsEnabled: true,
        };
    },
    groupInviteReceived(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_INVITE_RECEIVED,
            title: 'New Ajo Invite',
            body: `${params.adminName} has invited you to join the "${params.groupName}" Ajo group.`,
            smsEnabled: true,
        };
    },
    groupInviteAccepted(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_INVITE_ACCEPTED,
            title: 'Invite Accepted',
            body: `${params.memberName} has accepted your invite to "${params.groupName}".`,
        };
    },
    groupInviteDeclined(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_INVITE_DECLINED,
            title: 'Invite Declined',
            body: `${params.memberName} has declined your invite to "${params.groupName}".`,
        };
    },
    groupActivated(params) {
        const due = params.dueDate.toLocaleDateString('en-NG', {
            dateStyle: 'medium',
        });
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_ACTIVATED,
            title: 'Ajo Group Activated!',
            body: `"${params.groupName}" is now active. Fund your wallet with ₦${params.contributionAmount.toLocaleString()} before ${due}.`,
            smsEnabled: true,
        };
    },
    rotationOrderLocked(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.ROTATION_ORDER_LOCKED,
            title: 'Rotation Order Set',
            body: `The payout order for "${params.groupName}" has been locked. You are at position ${params.position}.`,
        };
    },
    groupUpdated(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_UPDATED,
            title: 'Group Details Updated',
            body: `${params.adminName} has updated the details for "${params.groupName}". Check the group page for the latest information.`,
        };
    },
    groupContinued(params) {
        const due = params.dueDate.toLocaleDateString('en-NG', { dateStyle: 'medium' });
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_CONTINUED,
            title: 'New Round Started!',
            body: `"${params.groupName}" has started a new round! Cycle #${params.cycleNumber} contribution of ₦${params.contributionAmount.toLocaleString()} is due by ${due}.`,
            smsEnabled: true,
        };
    },
    groupTerminated(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_TERMINATED,
            title: 'Group Terminated',
            body: `"${params.groupName}" has been terminated by the group admin.`,
            smsEnabled: true,
        };
    },
    contributionDueReminder(params) {
        const due = params.dueDate.toLocaleDateString('en-NG', {
            dateStyle: 'medium',
        });
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_DUE_REMINDER,
            title: 'Contribution Reminder',
            body: `Your ₦${params.amount.toLocaleString()} contribution for "${params.groupName}" is due in ${params.daysLeft} day(s) on ${due}. Make sure your wallet is funded.`,
        };
    },
    contributionDueUrgent(params) {
        const due = params.dueDate.toLocaleDateString('en-NG', {
            dateStyle: 'medium',
        });
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_DUE_URGENT,
            title: 'Contribution Due Today!',
            body: `Your ₦${params.amount.toLocaleString()} contribution for "${params.groupName}" is due today (${due}). Fund your wallet now to avoid being skipped.`,
            smsEnabled: true,
        };
    },
    contributionDebited(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_DEBITED,
            title: 'Contribution Paid',
            body: `₦${params.amount.toLocaleString()} has been deducted from your wallet for "${params.groupName}". New wallet balance: ₦${params.newBalance.toLocaleString()}.`,
        };
    },
    contributionFailedInsufficient(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_FAILED_INSUFFICIENT,
            title: 'Insufficient Wallet Balance',
            body: `Your wallet balance (₦${params.currentBalance.toLocaleString()}) is too low for your "${params.groupName}" contribution of ₦${params.amount.toLocaleString()}. Please top up now.`,
            smsEnabled: true,
        };
    },
    contributionDefaulted(params) {
        const due = params.dueDate.toLocaleDateString('en-NG', {
            dateStyle: 'medium',
        });
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_DEFAULTED,
            title: 'Missed Contribution',
            body: `Your ₦${params.amount.toLocaleString()} contribution for "${params.groupName}" was due on ${due} and hasn't been paid yet. Please fund your wallet so it can be collected.`,
            smsEnabled: true,
        };
    },
    adminDefaulterSummary(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_DEFAULTED,
            title: 'Defaulters Flagged',
            body: `${params.defaulterCount} member(s) missed their contribution for "${params.groupName}" (cycle ${params.cycleNumber}). Check the group dashboard for details.`,
        };
    },
    payoutInitiated(params) {
        const masked = `****${params.accountNumber.slice(-4)}`;
        return {
            ...params,
            type: notification_enum_1.NotificationType.PAYOUT_INITIATED,
            title: 'Payout On Its Way!',
            body: `₦${params.amount.toLocaleString()} is being transferred to your ${params.bankName} account ${masked} for "${params.groupName}".`,
            smsEnabled: true,
        };
    },
    payoutSuccess(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.PAYOUT_SUCCESS,
            title: 'Payout Successful 🎉',
            body: `₦${params.amount.toLocaleString()} has been successfully transferred to your bank account for "${params.groupName}".`,
            smsEnabled: true,
        };
    },
    payoutFailed(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.PAYOUT_FAILED,
            title: 'Payout Failed',
            body: `The ₦${params.amount.toLocaleString()} payout for "${params.groupName}" failed${params.reason ? `: ${params.reason}` : ''}. The funds have been returned to the group account. Please retry.`,
            smsEnabled: true,
        };
    },
    payoutReversed(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.PAYOUT_REVERSED,
            title: 'Payout Reversed',
            body: `The ₦${params.amount.toLocaleString()} payout for "${params.groupName}" was reversed by the bank. The funds have been returned to the group account. Please contact support.`,
            smsEnabled: true,
        };
    },
    cycleAdvanced(params) {
        const due = params.dueDate.toLocaleDateString('en-NG', {
            dateStyle: 'medium',
        });
        return {
            ...params,
            type: notification_enum_1.NotificationType.CYCLE_ADVANCED,
            title: 'New Cycle Started',
            body: `Cycle #${params.cycleNumber} for "${params.groupName}" has started. Contribution of ₦${params.contributionAmount.toLocaleString()} is due by ${due}.`,
            smsEnabled: false,
        };
    },
    walletFunded(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.WALLET_FUNDED,
            title: 'Wallet Funded',
            body: `₦${params.amount.toLocaleString()} has been added to your Ajo wallet. New balance: ₦${params.newBalance.toLocaleString()}.`,
        };
    },
};
//# sourceMappingURL=notification-events.js.map