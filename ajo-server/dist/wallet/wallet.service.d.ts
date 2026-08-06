import { ClientSession, Connection, Model, Types } from 'mongoose';
import { WalletDocument } from './schemas/wallet.schema';
import { WalletTransaction, WalletTransactionDocument } from './schemas/wallet-transaction.schema';
import { UsersService } from '../users/users.service';
import { PaystackService, BankListEntry } from '../payments/paystack.service';
import { BankAccount } from '../users/schemas/bank-account.schema';
import { SetBankAccountDto } from './dto/set-bank-account.dto';
import { NotificationsService } from '../notifications/notifications.service';
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
    }>;
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
    }>;
    confirmFunding(reference: string, amountNaira: number, metadata?: Record<string, unknown>): Promise<void>;
    failFunding(reference: string): Promise<void>;
    listBanks(): Promise<BankListEntry[]>;
    setBankAccount(userId: string, dto: SetBankAccountDto): Promise<BankAccount>;
    getBankAccount(userId: string): Promise<BankAccount | null>;
    debitForContribution(userId: Types.ObjectId, amountNaira: number, refs: {
        group: Types.ObjectId;
        cycle: Types.ObjectId;
        contribution: Types.ObjectId;
    }, session: ClientSession, serviceFee?: number): Promise<boolean>;
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
    confirmBillPayment(reference: string): Promise<void>;
    failBillPayment(reference: string, amountNaira: number, session: ClientSession): Promise<void>;
}
