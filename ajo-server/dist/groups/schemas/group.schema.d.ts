import { Document, Types } from 'mongoose';
import { ContributionFrequency, GroupStatus, RotationMethod } from '../../common/enums/group.enum';
export type GroupDocument = Group & Document;
export declare class Group {
    _id: Types.ObjectId;
    name: string;
    createdBy: Types.ObjectId;
    contributionAmount: number;
    frequency: ContributionFrequency;
    totalSlots: number;
    rotationMethod: RotationMethod;
    status: GroupStatus;
    orderLockedAt?: Date;
    startDate?: Date;
    currentCycleNumber?: number | null;
    autoCollectEnabled: boolean;
    serviceFee: number;
}
export declare const GroupSchema: import("mongoose").Schema<Group, import("mongoose").Model<Group, any, any, any, any, any, Group>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Group, Document<unknown, {}, Group, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdBy?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    contributionAmount?: import("mongoose").SchemaDefinitionProperty<number, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    frequency?: import("mongoose").SchemaDefinitionProperty<ContributionFrequency, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    totalSlots?: import("mongoose").SchemaDefinitionProperty<number, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    rotationMethod?: import("mongoose").SchemaDefinitionProperty<RotationMethod, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<GroupStatus, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    orderLockedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    startDate?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    currentCycleNumber?: import("mongoose").SchemaDefinitionProperty<number | null | undefined, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    autoCollectEnabled?: import("mongoose").SchemaDefinitionProperty<boolean, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    serviceFee?: import("mongoose").SchemaDefinitionProperty<number, Group, Document<unknown, {}, Group, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Group & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Group>;
