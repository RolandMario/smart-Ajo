/**
 * How often members contribute. Default is MONTHLY per product spec.
 */
export enum ContributionFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * How the payout order (rotation) is determined for a group.
 * Chosen by the group admin per-group at creation time.
 */
export enum RotationMethod {
  MANUAL = 'manual',
  RANDOM = 'random',
}

/**
 * Lifecycle of a Group.
 *
 * OPEN_FOR_INVITES -> admin can invite members; members accept/decline.
 * ORDER_LOCKED     -> all slots filled and accepted, rotation order set.
 *                     Cycle engine (Phase 3) takes over from here.
 * ACTIVE           -> contribution cycles are running.
 * COMPLETED        -> every member has collected their payout.
 * TERMINATED       -> admin chose to end the group after completion.
 */
export enum GroupStatus {
  OPEN_FOR_INVITES = 'open_for_invites',
  ORDER_LOCKED = 'order_locked',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  TERMINATED = 'terminated',
}

/**
 * Status of a single invite/membership record (GroupMember.inviteStatus).
 */
export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

/**
 * Whether a member has collected their payout for this rotation yet.
 * Set to COLLECTED when the admin marks them as having received their
 * payout (Phase 3).
 */
export enum PayoutStatus {
  PENDING = 'pending',
  COLLECTED = 'collected',
}
