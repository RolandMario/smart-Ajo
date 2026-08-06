import { Connection, Model } from 'mongoose';
import { WalletService } from '../wallet/wallet.service';
import { UsersService } from '../users/users.service';
import { PaystackService } from '../payments/paystack.service';
import { WalletTransactionDocument } from '../wallet/schemas/wallet-transaction.schema';
import { SetBankAccountDto } from '../wallet/dto/set-bank-account.dto';
import { BankAccount } from '../users/schemas/bank-account.schema';
export interface AdminWalletSummary {
    balance: number;
    currency: string;
    bankAccount: BankAccount | null;
    totalCommissionBalance: number;
    recentServiceFeeCredits: Array<{
        id: string;
        amount: number;
        balanceAfter: number;
        group?: {
            id: string;
            name: string;
        };
        createdAt: Date;
    }>;
    recentBillCommissionCredits: Array<{
        id: string;
        amount: number;
        balanceAfter: number;
        billType: string;
        userPaid: number;
        actualCost: number;
        createdAt: Date;
    }>;
}
export declare class PlatformAdminWalletService {
    private walletTxModel;
    private connection;
    private walletService;
    private usersService;
    private paystack;
    constructor(walletTxModel: Model<WalletTransactionDocument>, connection: Connection, walletService: WalletService, usersService: UsersService, paystack: PaystackService);
    getAdminWallet(): Promise<AdminWalletSummary>;
    withdraw(adminUserId: string, amountNaira: number): Promise<{
        message: string;
        amount: number;
        transferCode: string;
        status: string;
    }>;
    getBankAccount(adminUserId: string): Promise<BankAccount | null>;
    setBankAccount(adminUserId: string, dto: SetBankAccountDto): Promise<BankAccount>;
    listBanks(): Promise<import("../payments/paystack.service").BankListEntry[]>;
}
