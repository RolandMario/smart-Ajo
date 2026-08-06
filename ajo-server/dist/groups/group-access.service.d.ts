import { Model, Types } from 'mongoose';
import { GroupDocument } from './schemas/group.schema';
import { GroupMemberDocument } from './schemas/group-member.schema';
export declare class GroupAccessService {
    private groupModel;
    private groupMemberModel;
    constructor(groupModel: Model<GroupDocument>, groupMemberModel: Model<GroupMemberDocument>);
    getGroupOrThrow(groupId: string): Promise<GroupDocument>;
    getMembership(groupId: Types.ObjectId, userId: string): Promise<GroupMemberDocument | null>;
    assertGroupAdmin(groupId: Types.ObjectId, userId: string): Promise<GroupMemberDocument>;
    assertAcceptedMember(groupId: Types.ObjectId, userId: string): Promise<GroupMemberDocument>;
}
