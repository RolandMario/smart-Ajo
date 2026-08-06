import { PlatformAdminWalletService } from './platform-admin-wallet.service';
import { WithdrawAdminWalletDto } from './dto/withdraw-admin-wallet.dto';
import { SetBankAccountDto } from '../wallet/dto/set-bank-account.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class PlatformAdminWalletController {
    private adminWalletService;
    constructor(adminWalletService: PlatformAdminWalletService);
    getAdminWallet(): Promise<import("./platform-admin-wallet.service").AdminWalletSummary>;
    withdraw(user: RequestUser, dto: WithdrawAdminWalletDto): Promise<{
        message: string;
        amount: number;
        transferCode: string;
        status: string;
    }>;
    getBankAccount(user: RequestUser): Promise<import("../users/schemas/bank-account.schema").BankAccount | null>;
    setBankAccount(user: RequestUser, dto: SetBankAccountDto): Promise<import("../users/schemas/bank-account.schema").BankAccount>;
    listBanks(): Promise<import("../payments/paystack.service").BankListEntry[]>;
}
