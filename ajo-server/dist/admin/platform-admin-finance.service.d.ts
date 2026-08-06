import { Model } from 'mongoose';
import { WalletTransactionDocument } from '../wallet/schemas/wallet-transaction.schema';
import { PayoutDocument } from '../cycles/schemas/payout.schema';
import { GroupWalletTransactionDocument } from '../cycles/schemas/group-wallet-transaction.schema';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { ListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { ListGroupWalletTransactionsQueryDto } from './dto/list-group-wallet-transactions-query.dto';
export interface PaginatedWalletTransactions {
    transactions: Array<{
        id: string;
        user: {
            id: string;
            name?: string;
            phone: string;
        };
        type: string;
        status: string;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        reference: string;
        group?: {
            id: string;
            name: string;
        };
        createdAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface PaginatedPayouts {
    payouts: Array<{
        id: string;
        group: {
            id: string;
            name: string;
        };
        cycleNumber: number;
        recipient: {
            id: string;
            name?: string;
            phone: string;
        };
        initiatedBy: {
            id: string;
            name?: string;
            phone: string;
        };
        amount: number;
        status: string;
        failureReason?: string;
        paystackReference: string;
        completedAt?: Date;
        createdAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface PaginatedGroupWalletTransactions {
    transactions: Array<{
        id: string;
        group: {
            id: string;
            name: string;
        };
        type: string;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        createdAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare class PlatformAdminFinanceService {
    private walletTxModel;
    private payoutModel;
    private groupWalletTxModel;
    private cycleModel;
    constructor(walletTxModel: Model<WalletTransactionDocument>, payoutModel: Model<PayoutDocument>, groupWalletTxModel: Model<GroupWalletTransactionDocument>, cycleModel: Model<CycleDocument>);
    listWalletTransactions(query: ListWalletTransactionsQueryDto): Promise<PaginatedWalletTransactions>;
    listPayouts(query: ListPayoutsQueryDto): Promise<PaginatedPayouts>;
    listGroupWalletTransactions(query: ListGroupWalletTransactionsQueryDto): Promise<PaginatedGroupWalletTransactions>;
}
