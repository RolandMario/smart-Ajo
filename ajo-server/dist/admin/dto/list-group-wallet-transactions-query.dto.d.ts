import { GroupWalletTransactionType } from '../../common/enums/wallet.enum';
export declare class ListGroupWalletTransactionsQueryDto {
    type?: GroupWalletTransactionType;
    groupId?: string;
    page?: number;
    limit?: number;
}
