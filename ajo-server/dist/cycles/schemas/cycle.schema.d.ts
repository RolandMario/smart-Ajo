import { Document, Types } from 'mongoose';
import { CycleStatus } from '../../common/enums/cycle.enum';
export type CycleDocument = Cycle & Document;
export declare class Cycle {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    cycleNumber: number;
    recipientMember: Types.ObjectId;
    contributionAmount: number;
    totalSlots: number;
    dueDate: Date;
    status: CycleStatus;
    completedAt?: Date;
}
export declare const CycleSchema: import("mongoose").Schema<Cycle, import("mongoose").Model<Cycle, any, any, any, any, any, Cycle>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Cycle, Document<unknown, {}, Cycle, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    group?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    cycleNumber?: import("mongoose").SchemaDefinitionProperty<number, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    recipientMember?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    contributionAmount?: import("mongoose").SchemaDefinitionProperty<number, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    totalSlots?: import("mongoose").SchemaDefinitionProperty<number, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    dueDate?: import("mongoose").SchemaDefinitionProperty<Date, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<CycleStatus, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    completedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Cycle, Document<unknown, {}, Cycle, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cycle & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Cycle>;
