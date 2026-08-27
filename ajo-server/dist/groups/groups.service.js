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
exports.GroupsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const cycle_schema_1 = require("../cycles/schemas/cycle.schema");
const contribution_schema_1 = require("../cycles/schemas/contribution.schema");
const group_wallet_schema_1 = require("../cycles/schemas/group-wallet.schema");
const group_schema_1 = require("./schemas/group.schema");
const group_member_schema_1 = require("./schemas/group-member.schema");
const respond_to_invite_dto_1 = require("./dto/respond-to-invite.dto");
const cycle_enum_1 = require("../common/enums/cycle.enum");
const group_enum_1 = require("../common/enums/group.enum");
const users_service_1 = require("../users/users.service");
const group_access_service_1 = require("./group-access.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_events_1 = require("../notifications/notification-events");
const MEMBER_USER_FIELDS = 'name phone email';
let GroupsService = class GroupsService {
    groupModel;
    groupMemberModel;
    cycleModel;
    contributionModel;
    groupWalletModel;
    connection;
    usersService;
    groupAccess;
    notificationsService;
    constructor(groupModel, groupMemberModel, cycleModel, contributionModel, groupWalletModel, connection, usersService, groupAccess, notificationsService) {
        this.groupModel = groupModel;
        this.groupMemberModel = groupMemberModel;
        this.cycleModel = cycleModel;
        this.contributionModel = contributionModel;
        this.groupWalletModel = groupWalletModel;
        this.connection = connection;
        this.usersService = usersService;
        this.groupAccess = groupAccess;
        this.notificationsService = notificationsService;
    }
    async populateMember(id) {
        const member = await this.groupMemberModel
            .findById(id)
            .populate('user', MEMBER_USER_FIELDS)
            .lean();
        if (!member) {
            throw new common_1.NotFoundException('Group member not found');
        }
        return member;
    }
    shuffle(items) {
        const arr = [...items];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = (0, crypto_1.randomInt)(0, i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    computeNextDueDate(from, frequency) {
        const next = new Date(from);
        switch (frequency) {
            case group_enum_1.ContributionFrequency.DAILY:
                next.setDate(next.getDate() + 1);
                break;
            case group_enum_1.ContributionFrequency.WEEKLY:
                next.setDate(next.getDate() + 7);
                break;
            case group_enum_1.ContributionFrequency.MONTHLY:
            default:
                next.setMonth(next.getMonth() + 1);
                break;
        }
        return next;
    }
    async createCycleWithContributions(group, cycleNumber, recipientMember, dueDate, members, session) {
        const [cycle] = await this.cycleModel.create([
            {
                group: group._id,
                cycleNumber,
                recipientMember: recipientMember._id,
                contributionAmount: group.contributionAmount,
                totalSlots: group.totalSlots,
                dueDate,
                status: cycle_enum_1.CycleStatus.OPEN,
            },
        ], { session });
        await this.contributionModel.insertMany(members.map((m) => ({
            group: group._id,
            cycle: cycle._id,
            member: m._id,
            user: m.user,
            amount: group.contributionAmount,
            status: cycle_enum_1.ContributionStatus.PENDING,
        })), { session });
        return cycle;
    }
    async createGroup(userId, dto) {
        const session = await this.connection.startSession();
        try {
            let group;
            let membership;
            await session.withTransaction(async () => {
                const [groupDoc] = await this.groupModel.create([
                    {
                        name: dto.name,
                        createdBy: new mongoose_2.Types.ObjectId(userId),
                        contributionAmount: dto.contributionAmount,
                        frequency: dto.frequency ?? group_enum_1.ContributionFrequency.MONTHLY,
                        totalSlots: dto.totalSlots,
                        rotationMethod: dto.rotationMethod,
                    },
                ], { session });
                const [memberDoc] = await this.groupMemberModel.create([
                    {
                        group: groupDoc._id,
                        user: new mongoose_2.Types.ObjectId(userId),
                        isGroupAdmin: true,
                        inviteStatus: group_enum_1.InviteStatus.ACCEPTED,
                        respondedAt: new Date(),
                    },
                ], { session });
                group = groupDoc;
                membership = memberDoc;
            });
            return { group: group, membership: membership };
        }
        finally {
            await session.endSession();
        }
    }
    async listMyGroups(userId) {
        const memberships = await this.groupMemberModel
            .find({
            user: new mongoose_2.Types.ObjectId(userId),
            inviteStatus: group_enum_1.InviteStatus.ACCEPTED,
        })
            .lean();
        if (memberships.length === 0) {
            return [];
        }
        const groupIds = memberships.map((m) => m.group);
        const groups = await this.groupModel
            .find({ _id: { $in: groupIds }, status: { $ne: group_enum_1.GroupStatus.TERMINATED } })
            .lean();
        const groupsById = new Map(groups.map((g) => [g._id.toString(), g]));
        return memberships.map((m) => ({
            group: groupsById.get(m.group.toString()),
            membership: {
                id: m._id.toString(),
                isGroupAdmin: m.isGroupAdmin,
                position: m.position,
                payoutStatus: m.payoutStatus,
            },
        }));
    }
    async getGroupDetail(userId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertAcceptedMember(group._id, userId);
        const members = await this.listMembers(groupId);
        return { group, members };
    }
    async getMembers(userId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertAcceptedMember(group._id, userId);
        return this.listMembers(groupId);
    }
    async listMembers(groupId) {
        if (!mongoose_2.Types.ObjectId.isValid(groupId)) {
            throw new common_1.BadRequestException('Invalid group id');
        }
        return this.groupMemberModel
            .find({ group: new mongoose_2.Types.ObjectId(groupId) })
            .populate('user', MEMBER_USER_FIELDS)
            .sort({ position: 1, createdAt: 1 })
            .lean();
    }
    async inviteMember(adminUserId, groupId, phone) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        if (group.status !== group_enum_1.GroupStatus.OPEN_FOR_INVITES) {
            throw new common_1.BadRequestException('This group is no longer open for invites');
        }
        const invitee = await this.usersService.findByPhone(phone);
        if (!invitee || !invitee.isPhoneVerified) {
            throw new common_1.NotFoundException('This phone number is not registered on Ajo. The person must download the app and sign up before they can be invited.');
        }
        if (invitee._id.toString() === adminUserId) {
            throw new common_1.ConflictException('You are already the admin of this group');
        }
        const existing = await this.groupMemberModel.findOne({
            group: group._id,
            user: invitee._id,
        });
        if (existing && existing.inviteStatus !== group_enum_1.InviteStatus.DECLINED) {
            throw new common_1.ConflictException('This user has already been invited to this group');
        }
        const occupiedSlots = await this.groupMemberModel.countDocuments({
            group: group._id,
            inviteStatus: { $in: [group_enum_1.InviteStatus.ACCEPTED, group_enum_1.InviteStatus.PENDING] },
        });
        if (occupiedSlots >= group.totalSlots) {
            throw new common_1.BadRequestException('This group has no available slots');
        }
        let membership;
        if (existing) {
            existing.inviteStatus = group_enum_1.InviteStatus.PENDING;
            existing.invitedAt = new Date();
            existing.respondedAt = undefined;
            membership = await existing.save();
        }
        else {
            membership = await this.groupMemberModel.create({
                group: group._id,
                user: invitee._id,
                inviteStatus: group_enum_1.InviteStatus.PENDING,
                invitedAt: new Date(),
            });
        }
        const adminUser = await this.usersService.findById(adminUserId);
        const phones = new Map([
            [invitee._id.toString(), invitee.phone],
        ]);
        void this.notificationsService.send(notification_events_1.NotificationEvents.groupInviteReceived({
            userIds: [invitee._id.toString()],
            groupName: group.name,
            adminName: adminUser?.name ?? adminUser?.phone ?? 'The group admin',
            data: {
                groupId: group._id.toString(),
                inviteId: membership._id.toString(),
            },
            phones,
        }));
        return this.populateMember(membership._id);
    }
    async listMyInvites(userId) {
        const memberships = await this.groupMemberModel
            .find({
            user: new mongoose_2.Types.ObjectId(userId),
            inviteStatus: group_enum_1.InviteStatus.PENDING,
        })
            .lean();
        if (memberships.length === 0) {
            return [];
        }
        const groupIds = memberships.map((m) => m.group);
        const groups = await this.groupModel
            .find({ _id: { $in: groupIds } })
            .populate('createdBy', 'name phone')
            .lean();
        const groupsById = new Map(groups.map((g) => [g._id.toString(), g]));
        return memberships.map((m) => ({
            inviteId: m._id.toString(),
            invitedAt: m.invitedAt,
            group: groupsById.get(m.group.toString()),
        }));
    }
    async respondToInvite(userId, groupMemberId, action) {
        if (!mongoose_2.Types.ObjectId.isValid(groupMemberId)) {
            throw new common_1.BadRequestException('Invalid invite id');
        }
        const membership = await this.groupMemberModel.findById(groupMemberId);
        if (!membership) {
            throw new common_1.NotFoundException('Invite not found');
        }
        if (membership.user.toString() !== userId) {
            throw new common_1.ForbiddenException('This invite does not belong to you');
        }
        if (membership.inviteStatus !== group_enum_1.InviteStatus.PENDING) {
            throw new common_1.BadRequestException('This invite has already been responded to');
        }
        membership.inviteStatus =
            action === respond_to_invite_dto_1.InviteResponseAction.ACCEPT
                ? group_enum_1.InviteStatus.ACCEPTED
                : group_enum_1.InviteStatus.DECLINED;
        membership.respondedAt = new Date();
        await membership.save();
        const populated = await this.populateMember(membership._id);
        const group = await this.groupModel.findById(membership.group);
        const adminMembership = group
            ? await this.groupMemberModel.findOne({
                group: group._id,
                isGroupAdmin: true,
            })
            : null;
        if (group && adminMembership) {
            const respondingUser = await this.usersService.findById(userId);
            const memberName = respondingUser?.name ?? respondingUser?.phone ?? 'A member';
            const eventParams = {
                userIds: [adminMembership.user.toString()],
                memberName,
                groupName: group.name,
                data: { groupId: group._id.toString() },
            };
            void this.notificationsService.send(action === respond_to_invite_dto_1.InviteResponseAction.ACCEPT
                ? notification_events_1.NotificationEvents.groupInviteAccepted(eventParams)
                : notification_events_1.NotificationEvents.groupInviteDeclined(eventParams));
        }
        return populated;
    }
    async lockRotation(adminUserId, groupId, dto) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        if (group.status !== group_enum_1.GroupStatus.OPEN_FOR_INVITES) {
            throw new common_1.BadRequestException('The rotation order for this group has already been locked');
        }
        const acceptedMembers = await this.groupMemberModel
            .find({ group: group._id, inviteStatus: group_enum_1.InviteStatus.ACCEPTED })
            .sort({ createdAt: 1 });
        if (acceptedMembers.length !== group.totalSlots) {
            throw new common_1.BadRequestException(`All ${group.totalSlots} slots must be filled and accepted before locking the rotation order (currently ${acceptedMembers.length} accepted)`);
        }
        let orderedMembers;
        if (group.rotationMethod === group_enum_1.RotationMethod.MANUAL) {
            if (!dto.order || dto.order.length !== acceptedMembers.length) {
                throw new common_1.BadRequestException(`order must contain exactly ${acceptedMembers.length} group member ids`);
            }
            const acceptedIds = new Set(acceptedMembers.map((m) => m._id.toString()));
            const orderIds = new Set(dto.order);
            const sameSize = orderIds.size === dto.order.length;
            const sameMembers = sameSize && [...acceptedIds].every((id) => orderIds.has(id));
            if (!sameMembers) {
                throw new common_1.BadRequestException('order must contain exactly the accepted members of this group, each exactly once');
            }
            const byId = new Map(acceptedMembers.map((m) => [m._id.toString(), m]));
            orderedMembers = dto.order.map((id) => byId.get(id));
        }
        else {
            orderedMembers = this.shuffle(acceptedMembers);
        }
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                for (let i = 0; i < orderedMembers.length; i++) {
                    orderedMembers[i].position = i + 1;
                    await orderedMembers[i].save({ session });
                }
                group.status = group_enum_1.GroupStatus.ORDER_LOCKED;
                group.orderLockedAt = new Date();
                await group.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        void Promise.all(orderedMembers.map((member, index) => this.notificationsService.send(notification_events_1.NotificationEvents.rotationOrderLocked({
            userIds: [member.user.toString()],
            groupName: group.name,
            position: index + 1,
            data: { groupId: group._id.toString() },
        }))));
        return this.listMembers(groupId);
    }
    async continueGroup(adminUserId, groupId, dto) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        if (group.status !== group_enum_1.GroupStatus.COMPLETED) {
            throw new common_1.BadRequestException('Only completed groups can be continued');
        }
        if (dto.contributionAmount !== undefined) {
            group.contributionAmount = dto.contributionAmount;
        }
        if (dto.frequency !== undefined) {
            group.frequency = dto.frequency;
        }
        if (dto.totalSlots !== undefined) {
            const acceptedCount = await this.groupMemberModel.countDocuments({
                group: group._id,
                inviteStatus: group_enum_1.InviteStatus.ACCEPTED,
            });
            if (dto.totalSlots < acceptedCount) {
                throw new common_1.BadRequestException(`Cannot reduce slots below current member count (${acceptedCount})`);
            }
            group.totalSlots = dto.totalSlots;
        }
        const members = await this.groupMemberModel
            .find({ group: group._id, inviteStatus: group_enum_1.InviteStatus.ACCEPTED })
            .sort({ position: 1 });
        const recipient = members.find((m) => m.position === 1);
        if (!recipient) {
            throw new common_1.BadRequestException('No member found at rotation position 1');
        }
        for (const member of members) {
            member.payoutStatus = group_enum_1.PayoutStatus.PENDING;
        }
        await Promise.all(members.map((m) => m.save()));
        const now = new Date();
        const dueDate = this.computeNextDueDate(now, group.frequency);
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                let groupWallet = await this.groupWalletModel
                    .findOne({ group: group._id })
                    .session(session);
                if (!groupWallet) {
                    [groupWallet] = await this.groupWalletModel.create([{ group: group._id, balance: 0 }], { session });
                }
                await this.createCycleWithContributions(group, 1, recipient, dueDate, members, session);
                group.status = group_enum_1.GroupStatus.ACTIVE;
                group.startDate = now;
                group.currentCycleNumber = 1;
                await group.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        const memberIds = members.map((m) => m.user.toString());
        void this.notificationsService.send(notification_events_1.NotificationEvents.groupContinued({
            userIds: memberIds,
            groupName: group.name,
            cycleNumber: 1,
            contributionAmount: group.contributionAmount,
            dueDate,
            data: { groupId: group._id.toString() },
        }));
        return { group: group.toObject(), members };
    }
    async terminateGroup(adminUserId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        if (group.status !== group_enum_1.GroupStatus.COMPLETED) {
            throw new common_1.BadRequestException('Only completed groups can be terminated');
        }
        group.autoCollectEnabled = false;
        group.status = group_enum_1.GroupStatus.TERMINATED;
        await group.save();
        const members = await this.groupMemberModel.find({
            group: group._id,
            inviteStatus: group_enum_1.InviteStatus.ACCEPTED,
        });
        const memberIds = members.map((m) => m.user.toString());
        void this.notificationsService.send(notification_events_1.NotificationEvents.groupTerminated({
            userIds: memberIds,
            groupName: group.name,
            data: { groupId: group._id.toString() },
        }));
        return { groupId: group._id.toString(), status: group.status };
    }
    async setAutoCollect(adminUserId, groupId, enabled) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        group.autoCollectEnabled = enabled;
        await group.save();
        return {
            groupId: group._id.toString(),
            autoCollectEnabled: group.autoCollectEnabled,
        };
    }
    async updateGroup(adminUserId, groupId, dto) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        if (dto.name !== undefined) {
            group.name = dto.name;
        }
        if (dto.contributionAmount !== undefined) {
            group.contributionAmount = dto.contributionAmount;
        }
        if (dto.frequency !== undefined) {
            group.frequency = dto.frequency;
        }
        if (dto.totalSlots !== undefined) {
            const acceptedCount = await this.groupMemberModel.countDocuments({
                group: group._id,
                inviteStatus: group_enum_1.InviteStatus.ACCEPTED,
            });
            if (dto.totalSlots < acceptedCount) {
                throw new common_1.BadRequestException(`Cannot reduce slots below current member count (${acceptedCount})`);
            }
            group.totalSlots = dto.totalSlots;
        }
        await group.save();
        const updatedGroup = await this.groupModel.findById(group._id).lean();
        const members = await this.listMembers(groupId);
        const memberIds = members.map((m) => m.user.toString());
        const adminUser = await this.usersService.findById(adminUserId);
        const adminName = adminUser?.name ?? adminUser?.phone ?? 'Admin';
        void this.notificationsService.send(notification_events_1.NotificationEvents.groupUpdated({
            userIds: memberIds,
            groupName: group.name,
            adminName,
            data: { groupId: group._id.toString() },
        }));
        return { group: updatedGroup, members };
    }
};
exports.GroupsService = GroupsService;
exports.GroupsService = GroupsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(group_schema_1.Group.name)),
    __param(1, (0, mongoose_1.InjectModel)(group_member_schema_1.GroupMember.name)),
    __param(2, (0, mongoose_1.InjectModel)(cycle_schema_1.Cycle.name)),
    __param(3, (0, mongoose_1.InjectModel)(contribution_schema_1.Contribution.name)),
    __param(4, (0, mongoose_1.InjectModel)(group_wallet_schema_1.GroupWallet.name)),
    __param(5, (0, mongoose_1.InjectConnection)()),
    __param(8, (0, common_1.Inject)((0, common_1.forwardRef)(() => notifications_service_1.NotificationsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Connection,
        users_service_1.UsersService,
        group_access_service_1.GroupAccessService,
        notifications_service_1.NotificationsService])
], GroupsService);
//# sourceMappingURL=groups.service.js.map