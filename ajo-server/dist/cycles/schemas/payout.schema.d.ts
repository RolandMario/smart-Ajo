import { Document, Types } from 'mongoose';
import { TransferStatus } from '../../common/enums/wallet.enum';
export type PayoutDocument = Payout & Document;
export declare class Payout {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    cycle: Types.ObjectId;
    recipientMember: Types.ObjectId;
    recipientUser: Types.ObjectId;
    initiatedBy: Types.ObjectId;
    amount: number;
    status: TransferStatus;
    paystackTransferCode?: string;
    paystackReference: string;
    failureReason?: string;
    completedAt?: Date;
}
export declare const PayoutSchema: import("mongoose").Schema<Payout, import("mongoose").Model<Payout, any, any, any, any, any, Payout>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Payout, Document<unknown, {}, Payout, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    group?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    cycle?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    recipientMember?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    recipientUser?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    initiatedBy?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    amount?: import("mongoose").SchemaDefinitionProperty<number, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<TransferStatus, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    paystackTransferCode?: import("mongoose").SchemaDefinitionProperty<string | undefined, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    paystackReference?: import("mongoose").SchemaDefinitionProperty<string, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    failureReason?: import("mongoose").SchemaDefinitionProperty<string | undefined, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    completedAt?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Payout, Document<unknown, {}, Payout, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Payout & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Payout>;
