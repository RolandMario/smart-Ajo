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
    groupMemberJoined(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.GROUP_MEMBER_JOINED,
            title: 'New Group Member',
            body: `${params.memberName} joined your "${params.groupName}" group.`,
            smsEnabled: true,
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
        const due = params.dueDate.toLocaleDateString('en-NG', {
            dateStyle: 'medium',
        });
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
    contributionPaid(params) {
        const feeLine = params.serviceFee && params.serviceFee > 0
            ? ` (incl. ₦${params.serviceFee.toLocaleString()} service fee)`
            : '';
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_PAID,
            title: 'Contribution Paid ✅',
            body: `₦${params.amount.toLocaleString()}${feeLine} has been deducted from your wallet for "${params.groupName}". New wallet balance: ₦${params.newBalance.toLocaleString()}.`,
            smsEnabled: true,
        };
    },
    contributionAwaitingConfirmation(params) {
        const refLine = params.reference ? ` Reference: ${params.reference}.` : '';
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_AWAITING_CONFIRMATION,
            title: 'Payment to Confirm',
            body: `${params.memberName} says they've transferred ₦${params.amount.toLocaleString()} to the "${params.groupName}" escrow account.${refLine} Confirm it once verified.`,
            smsEnabled: true,
        };
    },
    contributionConfirmed(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_CONFIRMED,
            title: 'Contribution Confirmed ✅',
            body: `Your ₦${params.amount.toLocaleString()} contribution for "${params.groupName}" has been confirmed${params.roundLabel ? ` (${params.roundLabel})` : ''}.`,
            smsEnabled: true,
        };
    },
    contributionRejected(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.CONTRIBUTION_REJECTED,
            title: 'Payment Not Confirmed',
            body: `Your ₦${params.amount.toLocaleString()} bank transfer for "${params.groupName}" could not be confirmed${params.reason ? `: ${params.reason}` : ''}. Any service fee has been refunded to your wallet — please try again or contact your group admin.`,
            smsEnabled: true,
        };
    },
    escrowDepositReceived(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.ESCROW_DEPOSIT_RECEIVED,
            title: 'Escrow Transfer Received',
            body: `₦${params.amount.toLocaleString()} has landed in the "${params.groupName}" escrow account${params.senderName ? ` from ${params.senderName}` : ''}. Open the group to allocate it to a member's contribution.`,
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
    savingCreated(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.SAVING_CREATED,
            title: 'Savings Plan Started',
            body: `Your "${params.planName}" savings plan is live. Pay ₦${params.amount.toLocaleString()} from your wallet whenever a ${params.frequency} interval is due.`,
        };
    },
    savingDebited(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.SAVING_DEBITED,
            title: 'Savings Payment Received',
            body: `₦${params.amount.toLocaleString()} paid from your wallet into "${params.planName}". Plan balance: ₦${params.newBalance.toLocaleString()}.`,
        };
    },
    savingCompleted(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.SAVING_COMPLETED,
            title: 'Savings Cycle Complete 🎉',
            body: `You've saved ₦${params.total.toLocaleString()} in "${params.planName}". Your savings are ready to withdraw.`,
            smsEnabled: true,
        };
    },
    savingWithdrawn(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.SAVING_WITHDRAWN,
            title: 'Savings Withdrawn',
            body: `₦${params.amount.toLocaleString()} from "${params.planName}" has been sent to your bank account.`,
            smsEnabled: true,
        };
    },
    donationMemberJoined(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.DONATION_MEMBER_JOINED,
            title: 'New Pool Member',
            body: `${params.memberName} joined your "${params.poolName}" pool.`,
            smsEnabled: true,
        };
    },
    donationReceived(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.DONATION_RECEIVED,
            title: 'Donation Received',
            body: `Thank you! ₦${params.amount.toLocaleString()} was added to "${params.poolName}" from your wallet. The pool now holds ₦${params.escrowBalance.toLocaleString()}.`,
        };
    },
    donationReceivedAdmin(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.DONATION_RECEIVED_ADMIN,
            title: 'New Pool Donation',
            body: `${params.donorName} donated ₦${params.amount.toLocaleString()} to "${params.poolName}". Total collected: ₦${params.totalCollected.toLocaleString()}.`,
            smsEnabled: true,
        };
    },
    donationPayoutSuccess(params) {
        const masked = `****${params.accountNumber.slice(-4)}`;
        const feeNote = params.fee
            ? ` (₦${params.fee.toLocaleString()} platform fee deducted)`
            : '';
        return {
            ...params,
            type: notification_enum_1.NotificationType.DONATION_PAYOUT_SUCCESS,
            title: 'Pool Payout Successful',
            body: `₦${params.amount.toLocaleString()} from "${params.poolName}" has been sent to your ${params.bankName} account ${masked}${feeNote}.`,
            smsEnabled: true,
        };
    },
    donationPayoutFailed(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.DONATION_PAYOUT_FAILED,
            title: 'Pool Payout Failed',
            body: `The ₦${params.amount.toLocaleString()} payout for "${params.poolName}" failed${params.reason ? ` (${params.reason})` : ''}. The money is back in the pool — please try again.`,
            smsEnabled: true,
        };
    },
    donationPayoutReversed(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.DONATION_PAYOUT_REVERSED,
            title: 'Pool Payout Reversed',
            body: `The ₦${params.amount.toLocaleString()} payout for "${params.poolName}" was reversed by the bank. The money is back in the pool — please contact support.`,
            smsEnabled: true,
        };
    },
    donationPoolTerminated(params) {
        return {
            ...params,
            type: notification_enum_1.NotificationType.DONATION_POOL_TERMINATED,
            title: 'Pool Terminated',
            body: `"${params.poolName}" was terminated after more than two-thirds of its fully paid members voted to end it. Donations are closed; the admin can still pay out the pool balance.`,
            smsEnabled: true,
        };
    },
};
//# sourceMappingURL=notification-events.js.map