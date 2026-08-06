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
exports.GroupMemberSchema = exports.GroupMember = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const group_enum_1 = require("../../common/enums/group.enum");
let GroupMember = class GroupMember {
    _id;
    group;
    user;
    isGroupAdmin;
    inviteStatus;
    position;
    payoutStatus;
    invitedAt;
    respondedAt;
    defaultCount;
};
exports.GroupMember = GroupMember;
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'Group', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], GroupMember.prototype, "group", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Types.ObjectId, ref: 'User', required: true, index: true }),
    __metadata("design:type", mongoose_2.Types.ObjectId)
], GroupMember.prototype, "user", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], GroupMember.prototype, "isGroupAdmin", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: group_enum_1.InviteStatus, default: group_enum_1.InviteStatus.PENDING }),
    __metadata("design:type", String)
], GroupMember.prototype, "inviteStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Number, default: null }),
    __metadata("design:type", Object)
], GroupMember.prototype, "position", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, enum: group_enum_1.PayoutStatus, default: group_enum_1.PayoutStatus.PENDING }),
    __metadata("design:type", String)
], GroupMember.prototype, "payoutStatus", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], GroupMember.prototype, "invitedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], GroupMember.prototype, "respondedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0, min: 0 }),
    __metadata("design:type", Number)
], GroupMember.prototype, "defaultCount", void 0);
exports.GroupMember = GroupMember = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], GroupMember);
exports.GroupMemberSchema = mongoose_1.SchemaFactory.createForClass(GroupMember);
exports.GroupMemberSchema.index({ group: 1, user: 1 }, { unique: true });
//# sourceMappingURL=group-member.schema.js.map