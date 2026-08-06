import { TransferStatus } from '../../common/enums/wallet.enum';
export declare class ListPayoutsQueryDto {
    status?: TransferStatus;
    groupId?: string;
    page?: number;
    limit?: number;
}
