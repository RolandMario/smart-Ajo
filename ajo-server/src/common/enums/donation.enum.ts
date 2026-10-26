/**
 * Pool donation ("pool collection") enums.
 *
 * A DonationGroup is a pool a user creates to collect money from other
 * members for a purpose (birthday, funeral support, community project...).
 * Donations are debited from each donor's Ajo wallet into the pool's escrow
 * and paid out to the pool admin in one or more admin-initiated payouts.
 *
 * These enums intentionally live apart from ContributionFrequency /
 * GroupStatus: donations support YEARLY and free-will amounts, neither of
 * which makes sense for rotating Ajo circles, and sharing the enum would
 * leak those values into the circle DTOs and date math.
 */

/**
 * How much a donor gives per donation.
 *
 * FIXED     -> every donation is exactly `DonationGroup.amount`.
 * FREE_WILL -> the donor types the amount (bounded by the service limits).
 */
export enum DonationAmountType {
  FIXED = 'fixed',
  FREE_WILL = 'free_will',
}

/**
 * How often a donor may donate.
 *
 * ONE_TIME -> a single donation per member, forever (period key `once`).
 * INTERVAL -> one donation per member per calendar period (day / ISO week /
 *             month / year), enforced by the unique
 *             {group, user, period} index.
 */
export enum DonationSchedule {
  ONE_TIME = 'one_time',
  INTERVAL = 'interval',
}

/** Cadence of an INTERVAL pool. `schedule` must be INTERVAL when this is set. */
export enum DonationFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

/**
 * Lifecycle of a DonationGroup.
 *
 * ACTIVE     -> accepting new members and donations.
 * CLOSED     -> no new donations or members; escrow can still be paid out.
 * TERMINATED -> legacy marker from before termination deleted pools. Voting to
 *               terminate now purges the pool and every record scoped to it
 *               (`DonationsService.terminateGroup` → `purgeGroup`), so this
 *               value only survives on rows written by older API versions and
 *               is purged with `npm run seed:purge-terminated-pools`.
 */
export enum DonationGroupStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  TERMINATED = 'terminated',
}

/**
 * Type of a DonationEscrowTransaction (the pool's own ledger).
 *
 * DONATION_CREDIT        -> a member's donation moved wallet -> pool escrow.
 * PAYOUT_DEBIT           -> escrow funds left for the admin's bank account.
 * PAYOUT_REVERSAL_CREDIT -> a payout failed/was reversed; funds returned to
 *                           the pool escrow.
 */
export enum DonationEscrowTransactionType {
  DONATION_CREDIT = 'donation_credit',
  PAYOUT_DEBIT = 'payout_debit',
  PAYOUT_REVERSAL_CREDIT = 'payout_reversal_credit',
}
