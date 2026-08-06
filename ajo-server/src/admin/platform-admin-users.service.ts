import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../groups/schemas/group-member.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Wallet, WalletDocument } from '../wallet/schemas/wallet.schema';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

export interface PaginatedUsers {
  users: Array<{
    id: string;
    phone: string;
    email?: string;
    name?: string;
    role: string;
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    isActive: boolean;
    hasBankAccount: boolean;
    createdAt: Date;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserGroupSummary {
  groupId: string;
  groupName: string;
  groupStatus: string;
  isGroupAdmin: boolean;
  inviteStatus: string;
  position: number | null;
  payoutStatus: string;
  defaultCount: number;
}

export interface UserDetail {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  role: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  wallet: {
    balance: number;
    currency: string;
  };
  groups: UserGroupSummary[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Platform-admin-scoped read access to ALL users on the platform — for
 * the admin web console's Users directory. Distinct from UsersService,
 * which only ever resolves a single user the caller already knows the
 * id/phone/email of (used by auth, invites, etc.). Every method here is
 * "browse everyone," which is exactly the kind of access that should
 * stay behind PlatformAdminGuard and nowhere else.
 */
@Injectable()
export class PlatformAdminUsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
  ) {}

  /**
   * Paginated, optionally filtered/searched list of every user on the
   * platform. Search matches name, phone, or email as a case-insensitive
   * substring — deliberately simple (no full-text index) since this is
   * an internal tool with a user base that, even at scale, won't need
   * sub-100ms search relevance tuning.
   */
  async listUsers(query: ListUsersQueryDto): Promise<PaginatedUsers> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {};

    if (query.role) {
      filter.role = query.role;
    }

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      users: users.map((u) => ({
        id: u._id.toString(),
        phone: u.phone,
        email: u.email,
        name: u.name,
        role: u.role,
        isPhoneVerified: u.isPhoneVerified,
        isEmailVerified: u.isEmailVerified,
        isActive: u.isActive,
        hasBankAccount: !!u.bankAccount,
        createdAt: (u as unknown as { createdAt: Date }).createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Full detail view for a single user: profile, bank account (masked
   * to last 4 digits — this is a monitoring tool, not a place to
   * casually expose full account numbers to every platform_admin),
   * wallet balance, and every group they belong to with their standing
   * in each.
   */
  async getUserDetail(userId: string): Promise<UserDetail> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userModel.findById(userId).lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [wallet, memberships] = await Promise.all([
      this.walletModel.findOne({ user: user._id }).lean(),
      this.groupMemberModel.find({ user: user._id }).lean(),
    ]);

    const groupIds = memberships.map((m) => m.group);
    const groups = await this.groupModel
      .find({ _id: { $in: groupIds } })
      .lean();
    const groupsById = new Map(groups.map((g) => [g._id.toString(), g]));

    const groupSummaries: UserGroupSummary[] = memberships.map((m) => {
      const group = groupsById.get(m.group.toString());
      return {
        groupId: m.group.toString(),
        groupName: group?.name ?? '(deleted group)',
        groupStatus: group?.status ?? 'unknown',
        isGroupAdmin: m.isGroupAdmin,
        inviteStatus: m.inviteStatus,
        position: m.position,
        payoutStatus: m.payoutStatus,
        defaultCount: m.defaultCount,
      };
    });

    return {
      id: user._id.toString(),
      phone: user.phone,
      email: user.email,
      name: user.name,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      bankAccount: user.bankAccount
        ? {
            bankName: user.bankAccount.bankName,
            accountNumber: `****${user.bankAccount.accountNumber.slice(-4)}`,
            accountName: user.bankAccount.accountName,
          }
        : undefined,
      wallet: {
        balance: wallet?.balance ?? 0,
        currency: wallet?.currency ?? 'NGN',
      },
      groups: groupSummaries,
      createdAt: (user as unknown as { createdAt: Date }).createdAt,
      updatedAt: (user as unknown as { updatedAt: Date }).updatedAt,
    };
  }
}
