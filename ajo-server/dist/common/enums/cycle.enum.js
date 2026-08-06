"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContributionStatus = exports.CycleStatus = void 0;
var CycleStatus;
(function (CycleStatus) {
    CycleStatus["OPEN"] = "open";
    CycleStatus["COMPLETED"] = "completed";
})(CycleStatus || (exports.CycleStatus = CycleStatus = {}));
var ContributionStatus;
(function (ContributionStatus) {
    ContributionStatus["PENDING"] = "pending";
    ContributionStatus["PAID"] = "paid";
    ContributionStatus["DEFAULTED"] = "defaulted";
})(ContributionStatus || (exports.ContributionStatus = ContributionStatus = {}));
//# sourceMappingURL=cycle.enum.js.map