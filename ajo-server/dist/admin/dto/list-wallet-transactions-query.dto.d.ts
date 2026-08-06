import { WalletTransactionStatus, WalletTransactionType } from '../../common/enums/wallet.enum';
export declare class ListWalletTransactionsQueryDto {
    type?: WalletTransactionType;
    status?: WalletTransactionStatus;
    userId?: string;
    page?: number;
    limit?: number;
}
