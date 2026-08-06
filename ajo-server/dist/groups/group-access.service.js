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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupAccessService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const group_schema_1 = require("./schemas/group.schema");
const group_member_schema_1 = require("./schemas/group-member.schema");
const group_enum_1 = require("../common/enums/group.enum");
let GroupAccessService = class GroupAccessService {
    groupModel;
    groupMemberModel;
    constructor(groupModel, groupMemberModel) {
        this.groupModel = groupModel;
        this.groupMemberModel = groupMemberModel;
    }
    async getGroupOrThrow(groupId) {
        if (!mongoose_2.Types.ObjectId.isValid(groupId)) {
            throw new common_1.BadRequestException('Invalid group id');
        }
        const group = await this.groupModel.findById(groupId);
        if (!group) {
            throw new common_1.NotFoundException('Group not found');
        }
        return group;
    }
    async getMembership(groupId, userId) {
        return this.groupMemberModel.findOne({
            group: groupId,
            user: new mongoose_2.Types.ObjectId(userId),
        });
    }
    async assertGroupAdmin(groupId, userId) {
        const membership = await this.getMembership(groupId, userId);
        if (!membership || !membership.isGroupAdmin) {
            throw new common_1.ForbiddenException('Only the group admin can perform this action');
        }
        return membership;
    }
    async assertAcceptedMember(groupId, userId) {
        const membership = await this.getMembership(groupId, userId);
        if (!membership || membership.inviteStatus !== group_enum_1.InviteStatus.ACCEPTED) {
            throw new common_1.ForbiddenException('You are not a member of this group');
        }
        return membership;
    }
};
exports.GroupAccessService = GroupAccessService;
exports.GroupAccessService = GroupAccessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(group_schema_1.Group.name)),
    __param(1, (0, mongoose_1.InjectModel)(group_member_schema_1.GroupMember.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], GroupAccessService);
//# sourceMappingURL=group-access.service.js.map