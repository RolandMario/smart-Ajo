/**
 * Status of a single contribution cycle (one rotation of the Ajo).
 *
 * OPEN      -> collecting contributions / awaiting all members to pay.
 * COMPLETED -> all contributions paid, payout initiated to the
 *              recipient, and (if not the final cycle) the next cycle
 *              has been created.
 */
export enum CycleStatus {
  OPEN = 'open',
  COMPLETED = 'completed',
}

/**
 * Status of a single member's contribution within a cycle.
 *
 * DEFAULTED is a flag, not a fee — it's set when a contribution is still
 * PENDING after the cycle's dueDate has passed. It can still transition
 * to PAID later if the member tops up and the admin (re-)runs
 * collect-contributions; there is no penalty or suspension attached to
 * this status by itself.
 */
export enum ContributionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  DEFAULTED = 'defaulted',
}
