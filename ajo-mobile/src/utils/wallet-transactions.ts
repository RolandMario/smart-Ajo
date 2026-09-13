/**
 * Human-readable labels for personal wallet ledger transaction types,
 * shared by the Transactions list and the receipt screen.
 */
import type { WalletTransactionType } from "../types/api";

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  funding: "Wallet Funding",
  contribution_debit: "Contribution",
  contribution_refund: "Contribution Refund",
  bill_payment: "Bill Payment",
  service_fee_debit: "Service Fee",
  service_fee_credit: "Service Fee Credit",
  bill_commission_credit: "Bill Commission",
  admin_credit: "Wallet Credit",
  admin_withdrawal: "Withdrawal",
  savings_debit: "Savings",
};

export function transactionTypeLabel(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

/** Wallet transaction types that add money to the wallet (credits). */
const CREDIT_TYPES: readonly WalletTransactionType[] = [
  "funding",
  "contribution_refund",
  "service_fee_credit",
  "bill_commission_credit",
  "admin_credit",
];

/** Whether a wallet transaction type represents money coming in. */
export function isCreditTransaction(type: WalletTransactionType): boolean {
  return CREDIT_TYPES.includes(type);
}