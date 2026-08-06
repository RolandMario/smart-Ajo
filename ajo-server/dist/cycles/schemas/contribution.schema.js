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
exports.ContributionSchema = exports.Contribution = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const cycle_enum_1 = require("../../common/enums/cycle.enum");
let Contribution = class Contribution {
    _id;
    group;
    cycle;
    member;
    user;
    amount;
    serviceFee;
    status;
    paidAt;
    flaggedAt;
};
exports.Contribution = Contribution;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Group', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Contribution.prototype, "group", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Cycle', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Contribution.prototype, "cycle", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'GroupMember', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Contribution.prototype, "member", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Contribution.prototype, "user", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], Contribution.prototype, "amount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], Contribution.prototype, "serviceFee", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: cycle_enum_1.ContributionStatus,
        default: cycle_enum_1.ContributionStatus.PENDING,
    }),
    __metadata("design:type", String)
], Contribution.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Contribution.prototype, "paidAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Contribution.prototype, "flaggedAt", void 0);
exports.Contribution = Contribution = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Contribution);
exports.ContributionSchema = mongoose_1.SchemaFactory.createForClass(Contribution);
exports.ContributionSchema.index({ cycle: 1, member: 1 }, { unique: true });
//# sourceMappingURL=contribution.schema.js.map