"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferStatus = exports.GroupWalletTransactionType = exports.WalletTransactionStatus = exports.WalletTransactionType = void 0;
var WalletTransactionType;
(function (WalletTransactionType) {
    WalletTransactionType["FUNDING"] = "funding";
    WalletTransactionType["CONTRIBUTION_DEBIT"] = "contribution_debit";
    WalletTransactionType["CONTRIBUTION_REFUND"] = "contribution_refund";
    WalletTransactionType["BILL_PAYMENT"] = "bill_payment";
    WalletTransactionType["SERVICE_FEE_DEBIT"] = "service_fee_debit";
    WalletTransactionType["SERVICE_FEE_CREDIT"] = "service_fee_credit";
    WalletTransactionType["BILL_COMMISSION_CREDIT"] = "bill_commission_credit";
    WalletTransactionType["ADMIN_CREDIT"] = "admin_credit";
    WalletTransactionType["ADMIN_WITHDRAWAL"] = "admin_withdrawal";
})(WalletTransactionType || (exports.WalletTransactionType = WalletTransactionType = {}));
var WalletTransactionStatus;
(function (WalletTransactionStatus) {
    WalletTransactionStatus["PENDING"] = "pending";
    WalletTransactionStatus["SUCCESS"] = "success";
    WalletTransactionStatus["FAILED"] = "failed";
})(WalletTransactionStatus || (exports.WalletTransactionStatus = WalletTransactionStatus = {}));
var GroupWalletTransactionType;
(function (GroupWalletTransactionType) {
    GroupWalletTransactionType["CONTRIBUTION_CREDIT"] = "contribution_credit";
    GroupWalletTransactionType["PAYOUT_DEBIT"] = "payout_debit";
    GroupWalletTransactionType["PAYOUT_REVERSAL_CREDIT"] = "payout_reversal_credit";
    GroupWalletTransactionType["SERVICE_FEE_CREDIT"] = "service_fee_credit";
})(GroupWalletTransactionType || (exports.GroupWalletTransactionType = GroupWalletTransactionType = {}));
var TransferStatus;
(function (TransferStatus) {
    TransferStatus["PENDING"] = "pending";
    TransferStatus["SUCCESS"] = "success";
    TransferStatus["FAILED"] = "failed";
    TransferStatus["REVERSED"] = "reversed";
})(TransferStatus || (exports.TransferStatus = TransferStatus = {}));
//# sourceMappingURL=wallet.enum.js.map