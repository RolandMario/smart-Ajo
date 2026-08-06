import { GroupsService } from './groups.service';
import { RespondToInviteDto } from './dto/respond-to-invite.dto';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class InvitesController {
    private groupsService;
    constructor(groupsService: GroupsService);
    listMine(user: RequestUser): Promise<{
        inviteId: string;
        invitedAt: Date | undefined;
        group: (import("./schemas/group.schema").Group & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        }) | undefined;
    }[]>;
    respond(user: RequestUser, id: string, dto: RespondToInviteDto): Promise<import("./interfaces/populated-group-member.interface").PopulatedGroupMember>;
}
