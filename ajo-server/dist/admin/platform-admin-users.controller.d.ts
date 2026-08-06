import { PlatformAdminUsersService } from './platform-admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
export declare class PlatformAdminUsersController {
    private platformAdminUsersService;
    constructor(platformAdminUsersService: PlatformAdminUsersService);
    list(query: ListUsersQueryDto): Promise<import("./platform-admin-users.service").PaginatedUsers>;
    getDetail(id: string): Promise<import("./platform-admin-users.service").UserDetail>;
}
