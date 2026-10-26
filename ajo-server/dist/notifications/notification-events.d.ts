import { SendNotificationParams } from './notifications.service';
type EventParams = Omit<SendNotificationParams, 'type' | 'title' | 'body'>;
export declare const NotificationEvents: {
    billPaymentSuccess(params: EventParams & {
        amount: number;
        serviceType: string;
        recipient: string;
    }): SendNotificationParams;
    groupInviteReceived(params: EventParams & {
        groupName: string;
        adminName: string;
    }): SendNotificationParams;
    groupInviteAccepted(params: EventParams & {
        memberName: string;
        groupName: string;
    }): SendNotificationParams;
    groupInviteDeclined(params: EventParams & {
        memberName: string;
        groupName: string;
    }): SendNotificationParams;
    groupMemberJoined(params: EventParams & {
        memberName: string;
        groupName: string;
    }): SendNotificationParams;
    groupActivated(params: EventParams & {
        groupName: string;
        contributionAmount: number;
        frequency: string;
        dueDate: Date;
    }): SendNotificationParams;
    rotationOrderLocked(params: EventParams & {
        groupName: string;
        position: number;
    }): SendNotificationParams;
    groupUpdated(params: EventParams & {
        groupName: string;
        adminName: string;
    }): SendNotificationParams;
    groupContinued(params: EventParams & {
        groupName: string;
        cycleNumber: number;
        contributionAmount: number;
        dueDate: Date;
    }): SendNotificationParams;
    groupTerminated(params: EventParams & {
        groupName: string;
    }): SendNotificationParams;
    contributionDueReminder(params: EventParams & {
        groupName: string;
        amount: number;
        daysLeft: number;
        dueDate: Date;
    }): SendNotificationParams;
    contributionDueUrgent(params: EventParams & {
        groupName: string;
        amount: number;
        dueDate: Date;
    }): SendNotificationParams;
    contributionDebited(params: EventParams & {
        groupName: string;
        amount: number;
        newBalance: number;
    }): SendNotificationParams;
    contributionPaid(params: EventParams & {
        groupName: string;
        amount: number;
        newBalance: number;
        serviceFee?: number;
    }): SendNotificationParams;
    contributionAwaitingConfirmation(params: EventParams & {
        memberName: string;
        groupName: string;
        amount: number;
        reference?: string;
    }): SendNotificationParams;
    contributionConfirmed(params: EventParams & {
        groupName: string;
        amount: number;
        roundLabel?: string;
    }): SendNotificationParams;
    contributionRejected(params: EventParams & {
        groupName: string;
        amount: number;
        reason?: string;
    }): SendNotificationParams;
    escrowDepositReceived(params: EventParams & {
        groupName: string;
        amount: number;
        senderName?: string;
    }): SendNotificationParams;
    contributionFailedInsufficient(params: EventParams & {
        groupName: string;
        amount: number;
        currentBalance: number;
    }): SendNotificationParams;
    contributionDefaulted(params: EventParams & {
        groupName: string;
        amount: number;
        dueDate: Date;
    }): SendNotificationParams;
    adminDefaulterSummary(params: EventParams & {
        groupName: string;
        defaulterCount: number;
        cycleNumber: number;
    }): SendNotificationParams;
    payoutInitiated(params: EventParams & {
        groupName: string;
        amount: number;
        bankName: string;
        accountNumber: string;
    }): SendNotificationParams;
    payoutSuccess(params: EventParams & {
        groupName: string;
        amount: number;
    }): SendNotificationParams;
    payoutFailed(params: EventParams & {
        groupName: string;
        amount: number;
        reason?: string;
    }): SendNotificationParams;
    payoutReversed(params: EventParams & {
        groupName: string;
        amount: number;
    }): SendNotificationParams;
    cycleAdvanced(params: EventParams & {
        groupName: string;
        cycleNumber: number;
        contributionAmount: number;
        dueDate: Date;
    }): SendNotificationParams;
    walletFunded(params: EventParams & {
        amount: number;
        newBalance: number;
    }): SendNotificationParams;
    savingCreated(params: EventParams & {
        planName: string;
        amount: number;
        frequency: string;
    }): SendNotificationParams;
    savingDebited(params: EventParams & {
        planName: string;
        amount: number;
        newBalance: number;
    }): SendNotificationParams;
    savingCompleted(params: EventParams & {
        planName: string;
        total: number;
    }): SendNotificationParams;
    savingWithdrawn(params: EventParams & {
        planName: string;
        amount: number;
    }): SendNotificationParams;
    donationMemberJoined(params: EventParams & {
        memberName: string;
        poolName: string;
    }): SendNotificationParams;
    donationReceived(params: EventParams & {
        poolName: string;
        amount: number;
        windowLabel: string;
        escrowBalance: number;
    }): SendNotificationParams;
    donationReceivedAdmin(params: EventParams & {
        donorName: string;
        poolName: string;
        amount: number;
        totalCollected: number;
    }): SendNotificationParams;
    donationPayoutSuccess(params: EventParams & {
        poolName: string;
        amount: number;
        fee?: number;
        bankName: string;
        accountNumber: string;
    }): SendNotificationParams;
    donationPayoutFailed(params: EventParams & {
        poolName: string;
        amount: number;
        reason?: string;
    }): SendNotificationParams;
    donationPayoutReversed(params: EventParams & {
        poolName: string;
        amount: number;
    }): SendNotificationParams;
    donationPoolTerminated(params: EventParams & {
        poolName: string;
    }): SendNotificationParams;
};
export {};
