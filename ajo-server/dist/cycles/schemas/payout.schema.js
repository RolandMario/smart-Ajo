"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutSchema = exports.Payout = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const wallet_enum_1 = require("../../common/enums/wallet.enum");
let Payout = class Payout {
    _id;
    group;
    cycle;
    recipientMember;
    recipientUser;
    initiatedBy;
    amount;
    status;
    paystackTransferCode;
    paystackReference;
    failureReason;
    completedAt;
};
exports.Payout = Payout;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Group', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Payout.prototype, "group", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Cycle', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Payout.prototype, "cycle", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'GroupMember', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Payout.prototype, "recipientMember", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Payout.prototype, "recipientUser", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Payout.prototype, "initiatedBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], Payout.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: wallet_enum_1.TransferStatus, default: wallet_enum_1.TransferStatus.PENDING }),
    __metadata("design:type", String)
], Payout.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Payout.prototype, "paystackTransferCode", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Payout.prototype, "paystackReference", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Payout.prototype, "failureReason", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Payout.prototype, "completedAt", void 0);
exports.Payout = Payout = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Payout);
exports.PayoutSchema = mongoose_1.SchemaFactory.createForClass(Payout);
exports.PayoutSchema.index({ cycle: 1 }, { unique: true });
//# sourceMappingURL=payout.schema.js.map