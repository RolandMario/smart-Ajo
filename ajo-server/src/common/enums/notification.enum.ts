/**
 * Every distinct notification event in the app. Used as the `type` on
 * the Notification document so the mobile app can render a specific UI
 * per event type rather than generic text.
 */
export enum NotificationType {
  // Invites
  GROUP_INVITE_RECEIVED = 'group_invite_received',
  GROUP_INVITE_ACCEPTED = 'group_invite_accepted',
  GROUP_INVITE_DECLINED = 'group_invite_declined',

  // Group lifecycle
  GROUP_ACTIVATED = 'group_activated',
  GROUP_UPDATED = 'group_updated',
  GROUP_CONTINUED = 'group_continued',
  GROUP_TERMINATED = 'group_terminated',
  ROTATION_ORDER_LOCKED = 'rotation_order_locked',

  // Contributions
  CONTRIBUTION_DUE_REMINDER = 'contribution_due_reminder', // T-3 days
  CONTRIBUTION_DUE_URGENT = 'contribution_due_urgent', // T-1 day / same day
  CONTRIBUTION_DEBITED = 'contribution_debited', // member's wallet was debited
  CONTRIBUTION_FAILED_INSUFFICIENT = 'contribution_failed_insufficient', // wallet too low
  CONTRIBUTION_DEFAULTED = 'contribution_defaulted', // still pending after due date

  // Payouts
  PAYOUT_INITIATED = 'payout_initiated', // sent to recipient when transfer starts
  PAYOUT_SUCCESS = 'payout_success', // transfer confirmed
  PAYOUT_FAILED = 'payout_failed', // transfer failed, group admin
  PAYOUT_REVERSED = 'payout_reversed', // transfer reversed, group admin

  // Cycle lifecycle
  CYCLE_ADVANCED = 'cycle_advanced', // sent to all members when a new cycle starts

  // Wallet
  WALLET_FUNDED = 'wallet_funded', // top-up confirmed

  // Individual savings plans
  SAVING_CREATED = 'saving_created', // a savings plan was created
  SAVING_DEBITED = 'saving_debited', // an interval was auto-collected
  SAVING_INSUFFICIENT = 'saving_insufficient', // wallet too low for an interval
  SAVING_COMPLETED = 'saving_completed', // a full cycle finished, withdraw ready
  SAVING_WITHDRAWN = 'saving_withdrawn', // savings paid out to the bank
}

/**
 * Delivery channel for a notification attempt. A single logical
 * notification may generate entries for multiple channels (push + SMS).
 */
export enum NotificationChannel {
  PUSH = 'push',
  SMS = 'sms',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}
