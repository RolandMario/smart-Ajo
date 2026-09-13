import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { SetBankAccountDto } from './dto/set-bank-account.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class WalletController {
    private walletService;
    constructor(walletService: WalletService);
    getWallet(user: RequestUser): Promise<{
        balance: number;
        currency: string;
        recentTransactions: (import("./schemas/wallet-transaction.schema").WalletTransaction & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
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
    listTransactions(user: RequestUser, query: ListTransactionsQueryDto): Promise<import("./wallet.service").PaginatedWalletTransactions>;
    initializeFunding(user: RequestUser, dto: FundWalletDto): Promise<{
        authorizationUrl: string;
        reference: string;
    }>;
    verifyFunding(user: RequestUser, reference: string): Promise<{
        balance: number;
        currency: string;
        recentTransactions: (import("./schemas/wallet-transaction.schema").WalletTransaction & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
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
    getDedicatedAccount(user: RequestUser): Promise<import("../users/schemas/dedicated-account.schema").DedicatedAccount>;
    refreshDedicatedAccount(user: RequestUser): Promise<import("../users/schemas/dedicated-account.schema").DedicatedAccount>;
    listBanks(): Promise<import("../payments/paystack.service").BankListEntry[]>;
    getBankAccount(user: RequestUser): Promise<import("../users/schemas/bank-account.schema").BankAccount | null>;
    setBankAccount(user: RequestUser, dto: SetBankAccountDto): Promise<import("../users/schemas/bank-account.schema").BankAccount>;
}
