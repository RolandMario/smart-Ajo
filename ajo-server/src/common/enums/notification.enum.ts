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
  // A member joined via the shared Group ID (Join Group screen).
  GROUP_MEMBER_JOINED = 'group_member_joined',

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
  // Member paid their contribution from their wallet (self-serve).
  CONTRIBUTION_PAID = 'contribution_paid',
  // Member claims they sent a bank transfer into the group escrow account —
  // sent to the group admin so they can verify and confirm.
  CONTRIBUTION_AWAITING_CONFIRMATION = 'contribution_awaiting_confirmation',
  // Group admin confirmed a bank-transfer contribution — sent to the member.
  CONTRIBUTION_CONFIRMED = 'contribution_confirmed',
  // Group admin rejected a claimed bank-transfer contribution — sent to the member.
  CONTRIBUTION_REJECTED = 'contribution_rejected',
  // A bank transfer landed in the group's escrow DVA (unallocated deposit).
  ESCROW_DEPOSIT_RECEIVED = 'escrow_deposit_received',

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
  SAVING_DEBITED = 'saving_debited', // member paid an interval from their wallet
  SAVING_INSUFFICIENT = 'saving_insufficient', // legacy: wallet too low for an auto-debit
  SAVING_COMPLETED = 'saving_completed', // a full cycle finished, withdraw ready
  SAVING_WITHDRAWN = 'saving_withdrawn', // savings paid out to the bank

  // Pool donations ("pool collections")
  DONATION_RECEIVED = 'donation_received', // donor's own receipt
  DONATION_RECEIVED_ADMIN = 'donation_received_admin', // someone donated to the admin's pool
  DONATION_MEMBER_JOINED = 'donation_member_joined', // someone joined the admin's pool
  DONATION_PAYOUT_SUCCESS = 'donation_payout_success', // escrow paid out to the bank
  DONATION_PAYOUT_FAILED = 'donation_payout_failed', // transfer failed, funds returned
  DONATION_PAYOUT_REVERSED = 'donation_payout_reversed', // transfer reversed by the bank
  DONATION_POOL_TERMINATED = 'donation_pool_terminated', // 2/3 of fully paid members voted to end the pool
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
