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
exports.CycleSchema = exports.Cycle = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const cycle_enum_1 = require("../../common/enums/cycle.enum");
let Cycle = class Cycle {
    _id;
    group;
    cycleNumber;
    recipientMember;
    contributionAmount;
    totalSlots;
    dueDate;
    status;
    completedAt;
};
exports.Cycle = Cycle;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Group', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Cycle.prototype, "group", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], Cycle.prototype, "cycleNumber", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'GroupMember', required: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], Cycle.prototype, "recipientMember", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 1 }),
    __metadata("design:type", Number)
], Cycle.prototype, "contributionAmount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, min: 2 }),
    __metadata("design:type", Number)
], Cycle.prototype, "totalSlots", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Cycle.prototype, "dueDate", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: cycle_enum_1.CycleStatus, default: cycle_enum_1.CycleStatus.OPEN }),
    __metadata("design:type", String)
], Cycle.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], Cycle.prototype, "completedAt", void 0);
exports.Cycle = Cycle = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Cycle);
exports.CycleSchema = mongoose_1.SchemaFactory.createForClass(Cycle);
exports.CycleSchema.index({ group: 1, cycleNumber: 1 }, { unique: true });
//# sourceMappingURL=cycle.schema.js.map