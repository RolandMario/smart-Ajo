import { CyclesService } from './cycles.service';
import { EscrowService } from './escrow.service';
import { NotifyBankTransferDto } from './dto/notify-bank-transfer.dto';
import { RejectContributionDto } from './dto/reject-contribution.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class CyclesController {
    private cyclesService;
    private escrowService;
    constructor(cyclesService: CyclesService, escrowService: EscrowService);
    activate(user: RequestUser, groupId: string): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    listCycles(user: RequestUser, groupId: string): Promise<{
        paidCount: number;
        _id: import("mongoose").Types.ObjectId;
        group: import("mongoose").Types.ObjectId;
        cycleNumber: number;
        recipientMember: {
            _id: import("mongoose").Types.ObjectId;
            position: number | null;
            user: {
                _id: import("mongoose").Types.ObjectId;
                name?: string;
                phone: string;
                email?: string;
            };
        };
        contributionAmount: number;
        totalSlots: number;
        dueDate: Date;
        status: import("../common/enums/cycle.enum").CycleStatus;
        completedAt?: Date;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getCurrentCycle(user: RequestUser, groupId: string): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    payFromWallet(user: RequestUser, groupId: string, contributionId: string): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    notifyBankTransfer(user: RequestUser, groupId: string, contributionId: string, dto: NotifyBankTransferDto): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    confirmContribution(user: RequestUser, groupId: string, contributionId: string): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    rejectContribution(user: RequestUser, groupId: string, contributionId: string, dto: RejectContributionDto): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        escrowAccount: import("./escrow.service").PublicEscrowAccount | null;
        isAdmin: boolean;
        recipientPayoutReady: boolean;
    }>;
    getEscrowAccount(user: RequestUser, groupId: string): Promise<import("./escrow.service").PublicEscrowAccount | null>;
    refreshEscrowAccount(user: RequestUser, groupId: string): Promise<import("./escrow.service").PublicEscrowAccount | null>;
    listEscrowDeposits(user: RequestUser, groupId: string): Promise<{
        id: string;
        amount: number;
        escrowAccountNumber: string;
        providerReference: string;
        senderName: string | undefined;
        senderBank: string | undefined;
        narration: string | undefined;
        receivedAt: Date;
        status: import("./schemas/escrow-deposit.schema").EscrowDepositStatus;
        cycleId: string | undefined;
        contribution: import("mongoose").Types.ObjectId | undefined;
        allocatedAt: Date | undefined;
    }[]>;
    initiatePayout(user: RequestUser, groupId: string, cycleId: string): Promise<(import("./schemas/payout.schema").Payout & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
}
