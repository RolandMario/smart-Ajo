/**
 * Lifecycle of an individual savings plan.
 *
 * ACTIVE    -> currently collecting auto-debits from the wallet on each
 *              interval. When `collectedCount` reaches `intervalCount`,
 *              the cycle completes and the plan transitions to COMPLETED.
 * COMPLETED -> the current cycle's savings have been fully collected; the
 *              Withdraw button becomes available. Before withdrawing, the
 *              plan sits in this state holding `savingsBalance`.
 * WITHDRAWN -> funds for the completed cycle have been paid out to the
 *              member's bank account. The user is then prompted to either
 *              CONTINUE (starts a brand-new cycle, back to ACTIVE) or
 *              DELETE (removes the plan).
 * DELETED   -> the user chose not to continue after withdrawal; the plan
 *              is removed from active rotation (kept for history).
 */
export enum SavingPlanStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  WITHDRAWN = 'withdrawn',
  DELETED = 'deleted',
}

/**
 * Type of a SavingTransaction (the plan-scoped audit ledger).
 *
 * SAVING_DEBIT     -> wallet was debited at an interval and credited to
 *                     the plan's savingsBalance.
 * SAVING_WITHDRAWAL-> the accumulated savingsBalance was paid out to the
 *                     member's bank account via Paystack.
 * SAVING_REFUND    -> a failed/reversed withdrawal was returned to the
 *                     plan's savingsBalance.
 */
export enum SavingTransactionType {
  SAVING_DEBIT = 'saving_debit',
  SAVING_WITHDRAWAL = 'saving_withdrawal',
  SAVING_REFUND = 'saving_refund',
}
/**
 * The unit used for an individual savings plan's cycle length. `durationValue`
 * counts in this unit from the day the plan is created — e.g. days + 20 means
 * the plan runs for 20 days.
 */
export enum SavingDurationUnit {
  DAYS = 'days',
  MONTHS = 'months',
  YEARS = 'years',
}
