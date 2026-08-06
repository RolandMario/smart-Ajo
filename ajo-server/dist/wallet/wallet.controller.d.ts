import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { SetBankAccountDto } from './dto/set-bank-account.dto';
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
    }>;
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
    }>;
    listBanks(): Promise<import("../payments/paystack.service").BankListEntry[]>;
    getBankAccount(user: RequestUser): Promise<import("../users/schemas/bank-account.schema").BankAccount | null>;
    setBankAccount(user: RequestUser, dto: SetBankAccountDto): Promise<import("../users/schemas/bank-account.schema").BankAccount>;
}
