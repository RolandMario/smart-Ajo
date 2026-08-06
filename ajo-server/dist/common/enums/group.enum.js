"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutStatus = exports.InviteStatus = exports.GroupStatus = exports.RotationMethod = exports.ContributionFrequency = void 0;
var ContributionFrequency;
(function (ContributionFrequency) {
    ContributionFrequency["DAILY"] = "daily";
    ContributionFrequency["WEEKLY"] = "weekly";
    ContributionFrequency["MONTHLY"] = "monthly";
})(ContributionFrequency || (exports.ContributionFrequency = ContributionFrequency = {}));
var RotationMethod;
(function (RotationMethod) {
    RotationMethod["MANUAL"] = "manual";
    RotationMethod["RANDOM"] = "random";
})(RotationMethod || (exports.RotationMethod = RotationMethod = {}));
var GroupStatus;
(function (GroupStatus) {
    GroupStatus["OPEN_FOR_INVITES"] = "open_for_invites";
    GroupStatus["ORDER_LOCKED"] = "order_locked";
    GroupStatus["ACTIVE"] = "active";
    GroupStatus["COMPLETED"] = "completed";
    GroupStatus["TERMINATED"] = "terminated";
})(GroupStatus || (exports.GroupStatus = GroupStatus = {}));
var InviteStatus;
(function (InviteStatus) {
    InviteStatus["PENDING"] = "pending";
    InviteStatus["ACCEPTED"] = "accepted";
    InviteStatus["DECLINED"] = "declined";
})(InviteStatus || (exports.InviteStatus = InviteStatus = {}));
var PayoutStatus;
(function (PayoutStatus) {
    PayoutStatus["PENDING"] = "pending";
    PayoutStatus["COLLECTED"] = "collected";
})(PayoutStatus || (exports.PayoutStatus = PayoutStatus = {}));
//# sourceMappingURL=group.enum.js.map