import { PlatformAdminManagementService } from './platform-admin-management.service';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import { SetAdminActiveDto } from './dto/set-admin-active.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class PlatformAdminManagementController {
    private managementService;
    constructor(managementService: PlatformAdminManagementService);
    list(): Promise<import("./platform-admin-management.service").PlatformAdminListItem[]>;
    create(dto: CreatePlatformAdminDto): Promise<import("./platform-admin-management.service").PlatformAdminListItem>;
    setActive(user: RequestUser, id: string, dto: SetAdminActiveDto): Promise<import("./platform-admin-management.service").PlatformAdminListItem>;
}
