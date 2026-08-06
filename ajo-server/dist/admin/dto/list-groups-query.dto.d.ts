import { GroupStatus } from '../../common/enums/group.enum';
export declare class ListGroupsQueryDto {
    search?: string;
    status?: GroupStatus;
    page?: number;
    limit?: number;
}
