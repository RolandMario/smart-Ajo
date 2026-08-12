import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { GroupMemberDocument } from '../groups/schemas/group-member.schema';
import { GroupDocument } from '../groups/schemas/group.schema';
import { WalletDocument } from '../wallet/schemas/wallet.schema';
import { WalletService } from '../wallet/wallet.service';
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
export declare class PlatformAdminUsersService {
    private userModel;
    private groupMemberModel;
    private groupModel;
    private walletModel;
    private walletService;
    constructor(userModel: Model<UserDocument>, groupMemberModel: Model<GroupMemberDocument>, groupModel: Model<GroupDocument>, walletModel: Model<WalletDocument>, walletService: WalletService);
    listUsers(query: ListUsersQueryDto): Promise<PaginatedUsers>;
    getUserDetail(userId: string): Promise<UserDetail>;
    creditWallet(userId: string, amountNaira: number, note?: string): Promise<{
        balance: number;
        currency: string;
    }>;
}
