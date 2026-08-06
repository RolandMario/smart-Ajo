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
exports.GroupWalletTransactionSchema = exports.GroupWalletTransaction = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const wallet_enum_1 = require("../../common/enums/wallet.enum");
let GroupWalletTransaction = class GroupWalletTransaction {
    _id;
    groupWallet;
    group;
    type;
    amount;
    balanceBefore;
    balanceAfter;
    cycle;
    contribution;
    payout;
};
exports.GroupWalletTransaction = GroupWalletTransaction;
__decorate([
    (0, mongoose_1.Prop)({
        type: mongoose_2.Types.ObjectId,
        ref: 'GroupWallet',
        required: true,
        index: true,
    }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], GroupWalletTransaction.prototype, "groupWallet", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Group', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], GroupWalletTransaction.prototype, "group", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: wallet_enum_1.GroupWalletTransactionType, required: true }),
    __metadata("design:type", String)
], GroupWalletTransaction.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], GroupWalletTransaction.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], GroupWalletTransaction.prototype, "balanceBefore", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], GroupWalletTransaction.prototype, "balanceAfter", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Cycle' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], GroupWalletTransaction.prototype, "cycle", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Contribution' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], GroupWalletTransaction.prototype, "contribution", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Payout' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], GroupWalletTransaction.prototype, "payout", void 0);
exports.GroupWalletTransaction = GroupWalletTransaction = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], GroupWalletTransaction);
exports.GroupWalletTransactionSchema = mongoose_1.SchemaFactory.createForClass(GroupWalletTransaction);
//# sourceMappingURL=group-wallet-transaction.schema.js.map