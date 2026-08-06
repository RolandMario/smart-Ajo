import { NotificationType } from '../common/enums/notification.enum';
import { SendNotificationParams } from './notifications.service';

type EventParams = Omit<SendNotificationParams, 'type' | 'title' | 'body'>;

/**
 * Factory functions for every notification event in the app. Centralises
 * all notification copy so wording changes happen in one file and each
 * caller just passes structured data rather than formatting strings.
 */
export const NotificationEvents = {
  // ---- Bill payments ---------------------------------------------------------

  billPaymentSuccess(params: EventParams & { amount: number; serviceType: string; recipient: string }): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.WALLET_FUNDED,
      title: 'Bill Payment Successful',
      body: `Your ${params.serviceType} payment of \u20A6${params.amount} to ${params.recipient} was successful.`,
      smsEnabled: true,
    } as SendNotificationParams;
  },

  // ---- Invites ---------------------------------------------------------------

  groupInviteReceived(
    params: EventParams & { groupName: string; adminName: string },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.GROUP_INVITE_RECEIVED,
      title: 'New Ajo Invite',
      body: `${params.adminName} has invited you to join the "${params.groupName}" Ajo group.`,
      smsEnabled: true,
    };
  },

  groupInviteAccepted(
    params: EventParams & { memberName: string; groupName: string },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.GROUP_INVITE_ACCEPTED,
      title: 'Invite Accepted',
      body: `${params.memberName} has accepted your invite to "${params.groupName}".`,
    };
  },

  groupInviteDeclined(
    params: EventParams & { memberName: string; groupName: string },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.GROUP_INVITE_DECLINED,
      title: 'Invite Declined',
      body: `${params.memberName} has declined your invite to "${params.groupName}".`,
    };
  },

  // ---- Group lifecycle -------------------------------------------------------

  groupActivated(
    params: EventParams & {
      groupName: string;
      contributionAmount: number;
      frequency: string;
      dueDate: Date;
    },
  ): SendNotificationParams {
    const due = params.dueDate.toLocaleDateString('en-NG', {
      dateStyle: 'medium',
    });
    return {
      ...params,
      type: NotificationType.GROUP_ACTIVATED,
      title: 'Ajo Group Activated!',
      body: `"${params.groupName}" is now active. Fund your wallet with ₦${params.contributionAmount.toLocaleString()} before ${due}.`,
      smsEnabled: true,
    };
  },

  rotationOrderLocked(
    params: EventParams & { groupName: string; position: number },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.ROTATION_ORDER_LOCKED,
      title: 'Rotation Order Set',
      body: `The payout order for "${params.groupName}" has been locked. You are at position ${params.position}.`,
    };
  },

  groupUpdated(
    params: EventParams & { groupName: string; adminName: string },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.GROUP_UPDATED,
      title: 'Group Details Updated',
      body: `${params.adminName} has updated the details for "${params.groupName}". Check the group page for the latest information.`,
    };
  },

  groupContinued(
    params: EventParams & { groupName: string; cycleNumber: number; contributionAmount: number; dueDate: Date },
  ): SendNotificationParams {
    const due = params.dueDate.toLocaleDateString('en-NG', { dateStyle: 'medium' });
    return {
      ...params,
      type: NotificationType.GROUP_CONTINUED,
      title: 'New Round Started!',
      body: `"${params.groupName}" has started a new round! Cycle #${params.cycleNumber} contribution of ₦${params.contributionAmount.toLocaleString()} is due by ${due}.`,
      smsEnabled: true,
    };
  },

  groupTerminated(
    params: EventParams & { groupName: string },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.GROUP_TERMINATED,
      title: 'Group Terminated',
      body: `"${params.groupName}" has been terminated by the group admin.`,
      smsEnabled: true,
    };
  },

  // ---- Contribution reminders ------------------------------------------------

  contributionDueReminder(
    params: EventParams & {
      groupName: string;
      amount: number;
      daysLeft: number;
      dueDate: Date;
    },
  ): SendNotificationParams {
    const due = params.dueDate.toLocaleDateString('en-NG', {
      dateStyle: 'medium',
    });
    return {
      ...params,
      type: NotificationType.CONTRIBUTION_DUE_REMINDER,
      title: 'Contribution Reminder',
      body: `Your ₦${params.amount.toLocaleString()} contribution for "${params.groupName}" is due in ${params.daysLeft} day(s) on ${due}. Make sure your wallet is funded.`,
    };
  },

  contributionDueUrgent(
    params: EventParams & { groupName: string; amount: number; dueDate: Date },
  ): SendNotificationParams {
    const due = params.dueDate.toLocaleDateString('en-NG', {
      dateStyle: 'medium',
    });
    return {
      ...params,
      type: NotificationType.CONTRIBUTION_DUE_URGENT,
      title: 'Contribution Due Today!',
      body: `Your ₦${params.amount.toLocaleString()} contribution for "${params.groupName}" is due today (${due}). Fund your wallet now to avoid being skipped.`,
      smsEnabled: true,
    };
  },

  contributionDebited(
    params: EventParams & {
      groupName: string;
      amount: number;
      newBalance: number;
    },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.CONTRIBUTION_DEBITED,
      title: 'Contribution Paid',
      body: `₦${params.amount.toLocaleString()} has been deducted from your wallet for "${params.groupName}". New wallet balance: ₦${params.newBalance.toLocaleString()}.`,
    };
  },

  contributionFailedInsufficient(
    params: EventParams & {
      groupName: string;
      amount: number;
      currentBalance: number;
    },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.CONTRIBUTION_FAILED_INSUFFICIENT,
      title: 'Insufficient Wallet Balance',
      body: `Your wallet balance (₦${params.currentBalance.toLocaleString()}) is too low for your "${params.groupName}" contribution of ₦${params.amount.toLocaleString()}. Please top up now.`,
      smsEnabled: true,
    };
  },

  /**
   * Sent to the defaulting member themselves — a heads-up, not a
   * penalty notice. No fee language; the policy for this phase is
   * track-only.
   */
  contributionDefaulted(
    params: EventParams & { groupName: string; amount: number; dueDate: Date },
  ): SendNotificationParams {
    const due = params.dueDate.toLocaleDateString('en-NG', {
      dateStyle: 'medium',
    });
    return {
      ...params,
      type: NotificationType.CONTRIBUTION_DEFAULTED,
      title: 'Missed Contribution',
      body: `Your ₦${params.amount.toLocaleString()} contribution for "${params.groupName}" was due on ${due} and hasn't been paid yet. Please fund your wallet so it can be collected.`,
      smsEnabled: true,
    };
  },

  /**
   * Sent to the group admin summarizing how many members defaulted on
   * the current cycle, so they know to follow up without checking the
   * dashboard proactively every day.
   */
  adminDefaulterSummary(
    params: EventParams & {
      groupName: string;
      defaulterCount: number;
      cycleNumber: number;
    },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.CONTRIBUTION_DEFAULTED,
      title: 'Defaulters Flagged',
      body: `${params.defaulterCount} member(s) missed their contribution for "${params.groupName}" (cycle ${params.cycleNumber}). Check the group dashboard for details.`,
    };
  },

  // ---- Payouts ---------------------------------------------------------------

  payoutInitiated(
    params: EventParams & {
      groupName: string;
      amount: number;
      bankName: string;
      accountNumber: string;
    },
  ): SendNotificationParams {
    const masked = `****${params.accountNumber.slice(-4)}`;
    return {
      ...params,
      type: NotificationType.PAYOUT_INITIATED,
      title: 'Payout On Its Way!',
      body: `₦${params.amount.toLocaleString()} is being transferred to your ${params.bankName} account ${masked} for "${params.groupName}".`,
      smsEnabled: true,
    };
  },

  payoutSuccess(
    params: EventParams & { groupName: string; amount: number },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.PAYOUT_SUCCESS,
      title: 'Payout Successful 🎉',
      body: `₦${params.amount.toLocaleString()} has been successfully transferred to your bank account for "${params.groupName}".`,
      smsEnabled: true,
    };
  },

  payoutFailed(
    params: EventParams & {
      groupName: string;
      amount: number;
      reason?: string;
    },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.PAYOUT_FAILED,
      title: 'Payout Failed',
      body: `The ₦${params.amount.toLocaleString()} payout for "${params.groupName}" failed${params.reason ? `: ${params.reason}` : ''}. The funds have been returned to the group account. Please retry.`,
      smsEnabled: true,
    };
  },

  payoutReversed(
    params: EventParams & { groupName: string; amount: number },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.PAYOUT_REVERSED,
      title: 'Payout Reversed',
      body: `The ₦${params.amount.toLocaleString()} payout for "${params.groupName}" was reversed by the bank. The funds have been returned to the group account. Please contact support.`,
      smsEnabled: true,
    };
  },

  // ---- Cycle lifecycle -------------------------------------------------------

  cycleAdvanced(
    params: EventParams & {
      groupName: string;
      cycleNumber: number;
      contributionAmount: number;
      dueDate: Date;
    },
  ): SendNotificationParams {
    const due = params.dueDate.toLocaleDateString('en-NG', {
      dateStyle: 'medium',
    });
    return {
      ...params,
      type: NotificationType.CYCLE_ADVANCED,
      title: 'New Cycle Started',
      body: `Cycle #${params.cycleNumber} for "${params.groupName}" has started. Contribution of ₦${params.contributionAmount.toLocaleString()} is due by ${due}.`,
      smsEnabled: false,
    };
  },

  // ---- Wallet ----------------------------------------------------------------

  walletFunded(
    params: EventParams & { amount: number; newBalance: number },
  ): SendNotificationParams {
    return {
      ...params,
      type: NotificationType.WALLET_FUNDED,
      title: 'Wallet Funded',
      body: `₦${params.amount.toLocaleString()} has been added to your Ajo wallet. New balance: ₦${params.newBalance.toLocaleString()}.`,
    };
  },
};
