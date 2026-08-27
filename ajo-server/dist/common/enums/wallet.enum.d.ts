export declare enum WalletTransactionType {
    FUNDING = "funding",
    CONTRIBUTION_DEBIT = "contribution_debit",
    CONTRIBUTION_REFUND = "contribution_refund",
    BILL_PAYMENT = "bill_payment",
    SERVICE_FEE_DEBIT = "service_fee_debit",
    SERVICE_FEE_CREDIT = "service_fee_credit",
    BILL_COMMISSION_CREDIT = "bill_commission_credit",
    ADMIN_CREDIT = "admin_credit",
    ADMIN_WITHDRAWAL = "admin_withdrawal",
    SAVINGS_DEBIT = "savings_debit"
}
export declare enum WalletTransactionStatus {
    PENDING = "pending",
    SUCCESS = "success",
    FAILED = "failed"
}
export declare enum GroupWalletTransactionType {
    CONTRIBUTION_CREDIT = "contribution_credit",
    PAYOUT_DEBIT = "payout_debit",
    PAYOUT_REVERSAL_CREDIT = "payout_reversal_credit",
    SERVICE_FEE_CREDIT = "service_fee_credit"
}
export declare enum TransferStatus {
    PENDING = "pending",
    SUCCESS = "success",
    FAILED = "failed",
    REVERSED = "reversed"
}
