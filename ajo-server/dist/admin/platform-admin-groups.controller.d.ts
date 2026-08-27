import { PlatformAdminGroupsService } from './platform-admin-groups.service';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';
import { UpdateServiceFeeDto } from './dto/update-service-fee.dto';
import { SetAutoCollectDto } from './dto/set-auto-collect.dto';
export declare class PlatformAdminGroupsController {
    private platformAdminGroupsService;
    constructor(platformAdminGroupsService: PlatformAdminGroupsService);
    list(query: ListGroupsQueryDto): Promise<import("./platform-admin-groups.service").PaginatedGroups>;
    getDetail(id: string): Promise<import("./platform-admin-groups.service").GroupDetail>;
    updateServiceFee(id: string, dto: UpdateServiceFeeDto): Promise<import("./platform-admin-groups.service").GroupDetail>;
    setAutoCollect(id: string, dto: SetAutoCollectDto): Promise<import("./platform-admin-groups.service").GroupDetail>;
}
