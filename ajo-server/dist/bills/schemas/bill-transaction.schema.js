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
exports.BillTransactionSchema = exports.BillTransaction = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let BillTransaction = class BillTransaction {
    _id;
    user;
    type;
    status;
    amount;
    reference;
    externalReference;
    provider;
    recipient;
    metadata;
    walletTransaction;
};
exports.BillTransaction = BillTransaction;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], BillTransaction.prototype, "user", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        required: true,
        enum: ['airtime', 'data', 'cable', 'electricity'],
    }),
    __metadata("design:type", String)
], BillTransaction.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        required: true,
        enum: ['pending', 'success', 'failed'],
        default: 'pending',
    }),
    __metadata("design:type", String)
], BillTransaction.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 0 }),
    __metadata("design:type", Number)
], BillTransaction.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], BillTransaction.prototype, "reference", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], BillTransaction.prototype, "externalReference", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], BillTransaction.prototype, "provider", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], BillTransaction.prototype, "recipient", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], BillTransaction.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'WalletTransaction' }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], BillTransaction.prototype, "walletTransaction", void 0);
exports.BillTransaction = BillTransaction = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], BillTransaction);
exports.BillTransactionSchema = mongoose_1.SchemaFactory.createForClass(BillTransaction);
exports.BillTransactionSchema.index({ user: 1, createdAt: -1 });
//# sourceMappingURL=bill-transaction.schema.js.map