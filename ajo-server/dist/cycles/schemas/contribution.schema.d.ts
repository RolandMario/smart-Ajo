import { Document, Types } from 'mongoose';
import { ContributionStatus } from '../../common/enums/cycle.enum';
export type ContributionDocument = Contribution & Document;
export declare class Contribution {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    cycle: Types.ObjectId;
    member: Types.ObjectId;
    user: Types.ObjectId;
    amount: number;
    serviceFee: number;
    status: ContributionStatus;
    paidAt?: Date;
    flaggedAt?: Date;
}
export declare const ContributionSchema: import("mongoose").Schema<Contribution, import("mongoose").Model<Contribution, any, any, any, any, any, Contribution>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Contribution, Document<unknown, {}, Contribution, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    group?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    cycle?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    member?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    user?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    amount?: import("mongoose").SchemaDefinitionProperty<number, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    serviceFee?: import("mongoose").SchemaDefinitionProperty<number, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<ContributionStatus, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    paidAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    flaggedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Contribution, Document<unknown, {}, Contribution, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Contribution & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Contribution>;
