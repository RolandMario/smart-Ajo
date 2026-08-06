import { Types } from 'mongoose';
import { InviteStatus, PayoutStatus } from '../../common/enums/group.enum';
export interface PopulatedGroupMember {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    user: {
        _id: Types.ObjectId;
        name?: string;
        phone: string;
        email?: string;
    };
    isGroupAdmin: boolean;
    inviteStatus: InviteStatus;
    position: number | null;
    payoutStatus: PayoutStatus;
    invitedAt?: Date;
    respondedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
