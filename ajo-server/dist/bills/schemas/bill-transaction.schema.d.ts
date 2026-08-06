import { Document, Types } from 'mongoose';
export type BillTransactionDocument = BillTransaction & Document;
export declare class BillTransaction {
    _id: Types.ObjectId;
    user: Types.ObjectId;
    type: string;
    status: string;
    amount: number;
    reference: string;
    externalReference?: string;
    provider: string;
    recipient: string;
    metadata?: Record<string, unknown>;
    walletTransaction?: Types.ObjectId;
}
export declare const BillTransactionSchema: import("mongoose").Schema<BillTransaction, import("mongoose").Model<BillTransaction, any, any, any, any, any, BillTransaction>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, BillTransaction, Document<unknown, {}, BillTransaction, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    user?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<string, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    amount?: import("mongoose").SchemaDefinitionProperty<number, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    reference?: import("mongoose").SchemaDefinitionProperty<string, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    externalReference?: import("mongoose").SchemaDefinitionProperty<string | undefined, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    provider?: import("mongoose").SchemaDefinitionProperty<string, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    recipient?: import("mongoose").SchemaDefinitionProperty<string, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    metadata?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    walletTransaction?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, BillTransaction, Document<unknown, {}, BillTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BillTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, BillTransaction>;
