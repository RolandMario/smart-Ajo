"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContributionPaymentMethod = exports.ContributionStatus = exports.CycleStatus = void 0;
var CycleStatus;
(function (CycleStatus) {
    CycleStatus["OPEN"] = "open";
    CycleStatus["COMPLETED"] = "completed";
})(CycleStatus || (exports.CycleStatus = CycleStatus = {}));
var ContributionStatus;
(function (ContributionStatus) {
    ContributionStatus["PENDING"] = "pending";
    ContributionStatus["AWAITING_CONFIRMATION"] = "awaiting_confirmation";
    ContributionStatus["PAID"] = "paid";
    ContributionStatus["DEFAULTED"] = "defaulted";
})(ContributionStatus || (exports.ContributionStatus = ContributionStatus = {}));
var ContributionPaymentMethod;
(function (ContributionPaymentMethod) {
    ContributionPaymentMethod["WALLET"] = "wallet";
    ContributionPaymentMethod["BANK_TRANSFER"] = "bank_transfer";
})(ContributionPaymentMethod || (exports.ContributionPaymentMethod = ContributionPaymentMethod = {}));
//# sourceMappingURL=cycle.enum.js.map