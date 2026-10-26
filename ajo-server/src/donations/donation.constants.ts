/**
 * Shared limits and paging defaults for the pool donation feature.
 * Kept in one place so the DTOs, the service and the mobile app agree.
 */

/** Smallest donation accepted (₦). */
export const DONATION_MIN_AMOUNT = 100;

/** Largest single donation accepted (₦) — a sanity ceiling, not a policy. */
export const DONATION_MAX_AMOUNT = 5_000_000;

/** Smallest escrow payout (₦); matches Paystack's practical transfer floor. */
export const DONATION_PAYOUT_MIN_AMOUNT = 100;

/**
 * Period key used for ONE_TIME pools — every member may donate exactly once,
 * so the unique {group, user, period} index caps them at a single donation.
 */
export const DONATION_ONE_TIME_PERIOD = 'once';

/** Rows per page in the pool's donation history. */
export const DONATION_PAGE_SIZE = 10;

/** Hard cap so a client cannot page the whole history in one call. */
export const DONATION_MAX_PAGE_SIZE = 50;

/** Rows per page in the admin's payout history preview. */
export const DONATION_PAYOUT_PAGE_SIZE = 10;

/** "Recent donations" rows returned with the pool detail. */
export const DONATION_RECENT_LIMIT = 5;

/**
 * Termination threshold — a pool can be ended once this share of the members
 * who have made 100% of their payment towards the pool vote yes.
 *
 * 2/3 expressed as a fraction so the required number of yes votes is
 * `ceil(eligibleCount * NUMERATOR / DENOMINATOR)`, computed with integers to
 * avoid floating-point drift (e.g. 3 members -> 2 votes, 2 -> 2, 1 -> 1).
 */
export const DONATION_TERMINATION_VOTE_NUMERATOR = 2;
export const DONATION_TERMINATION_VOTE_DENOMINATOR = 3;
