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
exports.GroupSchema = exports.Group = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const group_enum_1 = require("../../common/enums/group.enum");
let Group = class Group {
    _id;
    name;
    createdBy;
    contributionAmount;
    frequency;
    totalSlots;
    rotationMethod;
    status;
    orderLockedAt;
    startDate;
    currentCycleNumber;
    autoCollectEnabled;
    serviceFee;
};
exports.Group = Group;
__decorate([
    (0, mongoose_1.Prop)({ required: true, trim: true }),
    __metadata("design:type", String)
], Group.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Group.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], Group.prototype, "contributionAmount", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: group_enum_1.ContributionFrequency,
        default: group_enum_1.ContributionFrequency.MONTHLY,
    }),
    __metadata("design:type", String)
], Group.prototype, "frequency", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 2 }),
    __metadata("design:type", Number)
], Group.prototype, "totalSlots", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: group_enum_1.RotationMethod, required: true }),
    __metadata("design:type", String)
], Group.prototype, "rotationMethod", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: group_enum_1.GroupStatus,
        default: group_enum_1.GroupStatus.OPEN_FOR_INVITES,
    }),
    __metadata("design:type", String)
], Group.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Group.prototype, "orderLockedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Group.prototype, "startDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], Group.prototype, "currentCycleNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Group.prototype, "autoCollectEnabled", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], Group.prototype, "serviceFee", void 0);
exports.Group = Group = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Group);
exports.GroupSchema = mongoose_1.SchemaFactory.createForClass(Group);
//# sourceMappingURL=group.schema.js.map