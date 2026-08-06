import { Document, Types } from 'mongoose';
import { InviteStatus, PayoutStatus } from '../../common/enums/group.enum';
export type GroupMemberDocument = GroupMember & Document;
export declare class GroupMember {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    user: Types.ObjectId;
    isGroupAdmin: boolean;
    inviteStatus: InviteStatus;
    position: number | null;
    payoutStatus: PayoutStatus;
    invitedAt?: Date;
    respondedAt?: Date;
    defaultCount: number;
}
export declare const GroupMemberSchema: import("mongoose").Schema<GroupMember, import("mongoose").Model<GroupMember, any, any, any, any, any, GroupMember>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, GroupMember, Document<unknown, {}, GroupMember, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    group?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    user?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isGroupAdmin?: import("mongoose").SchemaDefinitionProperty<boolean, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    inviteStatus?: import("mongoose").SchemaDefinitionProperty<InviteStatus, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    position?: import("mongoose").SchemaDefinitionProperty<number | null, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    payoutStatus?: import("mongoose").SchemaDefinitionProperty<PayoutStatus, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    invitedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    respondedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    defaultCount?: import("mongoose").SchemaDefinitionProperty<number, GroupMember, Document<unknown, {}, GroupMember, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupMember & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, GroupMember>;
