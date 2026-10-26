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
 * The member drives their own payment (see CyclesService):
 *  - WALLET: `payContributionFromWallet` debits the member's wallet and
 *    credits the group's escrow account. The contribution goes straight
 *    to PAID — no admin involvement.
 *  - BANK_TRANSFER: the member transfers into the group's escrow
 *    Dedicated Virtual Account and taps "I've paid – notify admin",
 *    which moves the contribution to AWAITING_CONFIRMATION and debits
 *    the service fee. The group admin verifies the credit and confirms
 *    it (-> PAID) or rejects it (-> back to PENDING).
 *
 * DEFAULTED is a flag, not a fee — it's set when a contribution is still
 * PENDING after the cycle's dueDate has passed. It can still transition
 * to PAID later. A contribution that is AWAITING_CONFIRMATION is never
 * flagged DEFAULTED (the member has already acted).
 */
export enum ContributionStatus {
  PENDING = 'pending',
  /** Member has notified the admin of an inbound bank transfer. */
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  PAID = 'paid',
  DEFAULTED = 'defaulted',
}

/**
 * How a member chose to pay their contribution.
 * Set when the contribution is paid (wallet) or claimed
 * (bank transfer) — null while it's still PENDING/DEFAULTED.
 */
export enum ContributionPaymentMethod {
  WALLET = 'wallet',
  BANK_TRANSFER = 'bank_transfer',
}
