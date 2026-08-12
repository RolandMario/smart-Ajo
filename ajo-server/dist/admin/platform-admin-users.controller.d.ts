import { PlatformAdminUsersService } from './platform-admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';
export declare class PlatformAdminUsersController {
    private platformAdminUsersService;
    constructor(platformAdminUsersService: PlatformAdminUsersService);
    list(query: ListUsersQueryDto): Promise<import("./platform-admin-users.service").PaginatedUsers>;
    getDetail(id: string): Promise<import("./platform-admin-users.service").UserDetail>;
    creditWallet(id: string, dto: CreditWalletDto): Promise<{
        balance: number;
        currency: string;
    }>;
}
