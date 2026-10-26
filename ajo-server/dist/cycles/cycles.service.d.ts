import { Connection, Model, Types } from 'mongoose';
import { CycleDocument } from './schemas/cycle.schema';
import { ContributionDocument } from './schemas/contribution.schema';
import { GroupWalletDocument } from './schemas/group-wallet.schema';
import { GroupWalletTransactionDocument } from './schemas/group-wallet-transaction.schema';
import { Payout, PayoutDocument } from './schemas/payout.schema';
import { GroupDocument } from '../groups/schemas/group.schema';
import { GroupMemberDocument } from '../groups/schemas/group-member.schema';
import { GroupAccessService } from '../groups/group-access.service';
import { WalletService } from '../wallet/wallet.service';
import { PaystackService } from '../payments/paystack.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EscrowService } from './escrow.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { CycleStatus } from '../common/enums/cycle.enum';
import { PopulatedContribution, PopulatedCycle } from './interfaces/populated-cycle.interface';
export declare class CyclesService {
    private cycleModel;
    private contributionModel;
    private groupMemberModel;
    private groupWalletModel;
    private groupWalletTxModel;
    private payoutModel;
    private connection;
    private groupAccess;
    private walletService;
    private paystack;
    private usersService;
    private escrowService;
    private notificationsService;
    private platformSettings;
    private readonly logger;
    constructor(cycleModel: Model<CycleDocument>, contributionModel: Model<ContributionDocument>, groupMemberModel: Model<GroupMemberDocument>, groupWalletModel: Model<GroupWalletDocument>, groupWalletTxModel: Model<GroupWalletTransactionDocument>, payoutModel: Model<PayoutDocument>, connection: Connection, groupAccess: GroupAccessService, walletService: WalletService, paystack: PaystackService, usersService: UsersService, escrowService: EscrowService, notificationsService: NotificationsService, platformSettings: PlatformSettingsService);
    private computeNextDueDate;
    private buildPaymentReference;
    private createCycleWithContributions;
    private creditGroupWallet;
    private debitGroupWallet;
    private reverseGroupWalletDebit;
    private getCycleOrThrow;
    private populateCycle;
    activateGroup(adminUserId: string, groupId: string): Promise<{
        cycle: PopulatedCycle;
        contributions: PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    listCycles(userId: string, groupId: string): Promise<{
        paidCount: number;
        _id: Types.ObjectId;
        group: Types.ObjectId;
        cycleNumber: number;
        recipientMember: {
            _id: Types.ObjectId;
            position: number | null;
            user: {
                _id: Types.ObjectId;
                name?: string;
                phone: string;
                email?: string;
            };
        };
        contributionAmount: number;
        totalSlots: number;
        dueDate: Date;
        status: CycleStatus;
        completedAt?: Date;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getCurrentCycle(userId: string, groupId: string): Promise<{
        cycle: PopulatedCycle;
        contributions: PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    private recipientPayoutReady;
    private backfillPaymentReferences;
    payContributionFromWallet(userId: string, groupId: string, contributionId: string): Promise<{
        cycle: PopulatedCycle;
        contributions: PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    notifyBankTransferPayment(userId: string, groupId: string, contributionId: string, claimedReference?: string): Promise<{
        cycle: PopulatedCycle;
        contributions: PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    confirmContributionPaid(adminUserId: string, groupId: string, contributionId: string): Promise<{
        cycle: PopulatedCycle;
        contributions: PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    rejectContributionPayment(adminUserId: string, groupId: string, contributionId: string, reason?: string): Promise<{
        cycle: PopulatedCycle;
        contributions: PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    private getContributionOrThrow;
    private getOwnContributionOrThrow;
    private getOpenCycleForContribution;
    initiatePayout(adminUserId: string, groupId: string, cycleId: string): Promise<(Payout & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    private finalizeAcceptedPayout;
    private describePayoutFailure;
    finalizeSuccessfulPayout(payout: PayoutDocument, cycle: CycleDocument, group: GroupDocument): Promise<void>;
    handleFailedPayout(payout: PayoutDocument, groupId: Types.ObjectId, cycleId: Types.ObjectId, reason: string): Promise<void>;
    handleReversedPayout(payout: PayoutDocument, group: GroupDocument): Promise<void>;
    findPayoutByReference(reference: string): Promise<PayoutDocument | null>;
    findGroupById(groupId: Types.ObjectId): Promise<GroupDocument | null>;
    findCycleById(cycleId: Types.ObjectId): Promise<CycleDocument | null>;
}
