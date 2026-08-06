import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { ContinueGroupDto } from './dto/continue-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { LockRotationDto } from './dto/lock-rotation.dto';
import { SetAutoCollectDto } from './dto/set-auto-collect.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class GroupsController {
    private groupsService;
    constructor(groupsService: GroupsService);
    create(user: RequestUser, dto: CreateGroupDto): Promise<{
        group: import("./schemas/group.schema").GroupDocument;
        membership: import("./schemas/group-member.schema").GroupMemberDocument;
    }>;
    listMine(user: RequestUser): Promise<{
        group: (import("./schemas/group.schema").Group & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        }) | undefined;
        membership: {
            id: string;
            isGroupAdmin: boolean;
            position: number | null;
            payoutStatus: import("../common/enums/group.enum").PayoutStatus;
        };
    }[]>;
    getDetail(user: RequestUser, id: string): Promise<{
        group: import("./schemas/group.schema").GroupDocument;
        members: import("./interfaces/populated-group-member.interface").PopulatedGroupMember[];
    }>;
    getMembers(user: RequestUser, id: string): Promise<import("./interfaces/populated-group-member.interface").PopulatedGroupMember[]>;
    invite(user: RequestUser, id: string, dto: InviteMemberDto): Promise<import("./interfaces/populated-group-member.interface").PopulatedGroupMember>;
    lockRotation(user: RequestUser, id: string, dto: LockRotationDto): Promise<import("./interfaces/populated-group-member.interface").PopulatedGroupMember[]>;
    setAutoCollect(user: RequestUser, id: string, dto: SetAutoCollectDto): Promise<{
        groupId: string;
        autoCollectEnabled: boolean;
    }>;
    update(user: RequestUser, id: string, dto: UpdateGroupDto): Promise<{
        group: (import("./schemas/group.schema").Group & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        }) | null;
        members: import("./interfaces/populated-group-member.interface").PopulatedGroupMember[];
    }>;
    continue(user: RequestUser, id: string, dto: ContinueGroupDto): Promise<{
        group: any;
        members: (import("mongoose").Document<unknown, {}, import("./schemas/group-member.schema").GroupMemberDocument, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/group-member.schema").GroupMember & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    terminate(user: RequestUser, id: string): Promise<{
        groupId: string;
        status: import("../common/enums/group.enum").GroupStatus.TERMINATED;
    }>;
}
