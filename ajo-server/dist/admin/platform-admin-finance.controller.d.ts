import { PlatformAdminFinanceService } from './platform-admin-finance.service';
import { ListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { ListGroupWalletTransactionsQueryDto } from './dto/list-group-wallet-transactions-query.dto';
export declare class PlatformAdminFinanceController {
    private financeService;
    constructor(financeService: PlatformAdminFinanceService);
    listWalletTransactions(query: ListWalletTransactionsQueryDto): Promise<import("./platform-admin-finance.service").PaginatedWalletTransactions>;
    listPayouts(query: ListPayoutsQueryDto): Promise<import("./platform-admin-finance.service").PaginatedPayouts>;
    listGroupWalletTransactions(query: ListGroupWalletTransactionsQueryDto): Promise<import("./platform-admin-finance.service").PaginatedGroupWalletTransactions>;
}
