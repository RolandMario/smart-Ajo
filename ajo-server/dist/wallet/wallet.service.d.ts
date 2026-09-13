import { ClientSession, Connection, Model, Types } from 'mongoose';
import { WalletDocument } from './schemas/wallet.schema';
import { WalletTransaction, WalletTransactionDocument } from './schemas/wallet-transaction.schema';
import { UsersService } from '../users/users.service';
import { DedicatedAccount } from '../users/schemas/dedicated-account.schema';
import { BankListEntry, PaystackService } from '../payments/paystack.service';
import { BankAccount } from '../users/schemas/bank-account.schema';
import { SetBankAccountDto } from './dto/set-bank-account.dto';
import { NotificationsService } from '../notifications/notifications.service';
export interface PaginatedWalletTransactions {
    transactions: WalletTransaction[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare class WalletService {
    private walletModel;
    private walletTxModel;
    private connection;
    private usersService;
    private paystack;
    private notificationsService;
    constructor(walletModel: Model<WalletDocument>, walletTxModel: Model<WalletTransactionDocument>, connection: Connection, usersService: UsersService, paystack: PaystackService, notificationsService: NotificationsService);
    getOrCreateWallet(userId: string): Promise<WalletDocument>;
    getWalletSummary(userId: string): Promise<{
        balance: number;
        currency: string;
        recentTransactions: (WalletTransaction & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        dedicatedAccount: {
            paystackCustomerCode: string | undefined;
            accountNumber: string | undefined;
            accountName: string | undefined;
            bankName: string | undefined;
            provider: string;
            currency: string;
            active: boolean;
        } | null;
    }>;
    listTransactions(userId: string, page?: number, limit?: number): Promise<PaginatedWalletTransactions>;
    initializeFunding(userId: string, amountNaira: number): Promise<{
        authorizationUrl: string;
        reference: string;
    }>;
    verifyFunding(userId: string, reference: string): Promise<{
        balance: number;
        currency: string;
        recentTransactions: (WalletTransaction & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        dedicatedAccount: {
            paystackCustomerCode: string | undefined;
            accountNumber: string | undefined;
            accountName: string | undefined;
            bankName: string | undefined;
            provider: string;
            currency: string;
            active: boolean;
        } | null;
    }>;
    confirmFunding(reference: string, amountNaira: number, metadata?: Record<string, unknown>): Promise<boolean>;
    failFunding(reference: string): Promise<void>;
    getOrCreateDedicatedAccount(userId: string): Promise<DedicatedAccount>;
    refreshDedicatedAccount(userId: string): Promise<DedicatedAccount>;
    creditDedicatedAccountFunding(params: {
        phone: string;
        amountNaira: number;
        reference: string;
        paystackData?: Record<string, unknown>;
    }): Promise<boolean>;
    private splitName;
    private createPaystackCustomer;
    listBanks(): Promise<BankListEntry[]>;
    setBankAccount(userId: string, dto: SetBankAccountDto): Promise<BankAccount>;
    getBankAccount(userId: string): Promise<BankAccount | null>;
    debitForContribution(userId: Types.ObjectId, amountNaira: number, refs: {
        group: Types.ObjectId;
        cycle: Types.ObjectId;
        contribution: Types.ObjectId;
    }, session: ClientSession, serviceFee?: number): Promise<boolean>;
    debitForSavings(userId: Types.ObjectId, amountNaira: number, refs: {
        savingPlan: Types.ObjectId;
    }, reference: string, session: ClientSession): Promise<boolean>;
    creditServiceFee(adminUserId: string, amount: number, refs: {
        group: Types.ObjectId;
        cycle: Types.ObjectId;
        contribution: Types.ObjectId;
    }, session: ClientSession): Promise<void>;
    creditBillCommission(adminUserId: string, commissionAmount: number, refs: {
        billReference: string;
        billType: string;
        userPaid: number;
        actualCost: number;
    }, session: ClientSession): Promise<void>;
    debitForBillPayment(userId: Types.ObjectId, amountNaira: number, reference: string, metadata: Record<string, unknown>, session: ClientSession): Promise<WalletTransactionDocument | null>;
    confirmBillPayment(reference: string, session?: ClientSession): Promise<void>;
    failBillPayment(reference: string, amountNaira: number, session: ClientSession): Promise<void>;
    creditUserWallet(userId: string, amountNaira: number, note?: string): Promise<{
        balance: number;
        currency: string;
    }>;
}
