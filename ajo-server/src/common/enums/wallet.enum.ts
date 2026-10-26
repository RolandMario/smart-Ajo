/**
 * Type of a personal Wallet ledger entry (WalletTransaction).
 *
 * FUNDING            -> member topped up their wallet via Paystack.
 * CONTRIBUTION_DEBIT -> wallet was automatically debited for a cycle
 *                       contribution, crediting the group's central
 *                       account (GroupWallet).
 * CONTRIBUTION_REFUND -> a previously-debited contribution was reversed
 *                       (e.g. the cycle was cancelled) and the amount
 *                       was returned to the member's wallet.
 * SERVICE_FEE_DEBIT  -> wallet was debited for the platform service fee
 *                       when a contribution was collected.
 * SERVICE_FEE_REFUND -> a previously-debited service fee was returned to
 *                       the member's wallet (e.g. the admin rejected a
 *                       claimed bank transfer).
 * DONATION_DEBIT     -> wallet was debited to fund a donation into a
 *                       DonationGroup (pool collection) escrow.
 */
export enum WalletTransactionType {
  FUNDING = 'funding',
  CONTRIBUTION_DEBIT = 'contribution_debit',
  CONTRIBUTION_REFUND = 'contribution_refund',
  BILL_PAYMENT = 'bill_payment',
  SERVICE_FEE_DEBIT = 'service_fee_debit',
  SERVICE_FEE_REFUND = 'service_fee_refund',
  SERVICE_FEE_CREDIT = 'service_fee_credit',
  BILL_COMMISSION_CREDIT = 'bill_commission_credit',
  ADMIN_CREDIT = 'admin_credit',
  ADMIN_WITHDRAWAL = 'admin_withdrawal',
  SAVINGS_DEBIT = 'savings_debit',
  /** Wallet debited to fund a pool donation (moved into the pool's escrow). */
  DONATION_DEBIT = 'donation_debit',
}

/**
 * Status of a WalletTransaction. FUNDING entries start PENDING until
 * Paystack confirms the charge (via webhook or manual verify); all other
 * entry types are created already SUCCESS since they're internal,
 * synchronous ledger movements.
 */
export enum WalletTransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Type of a GroupWallet (central account) ledger entry.
 *
 * CONTRIBUTION_CREDIT -> a member's contribution was debited from their
 *                        wallet into the group's central account.
 * PAYOUT_DEBIT        -> funds left the central account as part of an
 *                        admin-initiated payout to the cycle recipient.
 * PAYOUT_REVERSAL_CREDIT -> a payout's transfer failed/reversed and the
 *                        amount was returned to the central account.
 * SERVICE_FEE_CREDIT  -> the platform service fee was credited to the
 *                        platform admin's wallet from a member's wallet.
 * ESCROW_DEPOSIT_CREDIT -> a bank transfer into the group's escrow
 *                        Dedicated Virtual Account settled (Paystack
 *                        `charge.success`). Recorded as soon as the money
 *                        arrives — before the admin has allocated it to a
 *                        specific member's contribution.
 */
export enum GroupWalletTransactionType {
  CONTRIBUTION_CREDIT = 'contribution_credit',
  ESCROW_DEPOSIT_CREDIT = 'escrow_deposit_credit',
  PAYOUT_DEBIT = 'payout_debit',
  PAYOUT_REVERSAL_CREDIT = 'payout_reversal_credit',
  SERVICE_FEE_CREDIT = 'service_fee_credit',
}

/**
 * Status of a Payout (the transfer to a cycle's recipient).
 *
 * PENDING  -> transfer initiated with Paystack, awaiting confirmation
 *             (Paystack may require OTP finalization or async webhook).
 * SUCCESS  -> transfer confirmed successful; cycle completed, rotation
 *             advanced.
 * FAILED   -> transfer failed outright; central account refunded, cycle
 *             remains open for retry.
 * REVERSED -> transfer succeeded then was later reversed by Paystack;
 *             central account refunded.
 */
export enum TransferStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REVERSED = 'reversed',
}
