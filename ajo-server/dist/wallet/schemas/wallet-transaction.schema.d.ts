import { Document, Types } from 'mongoose';
import { WalletTransactionStatus, WalletTransactionType } from '../../common/enums/wallet.enum';
export type WalletTransactionDocument = WalletTransaction & Document;
export declare class WalletTransaction {
    _id: Types.ObjectId;
    wallet: Types.ObjectId;
    user: Types.ObjectId;
    type: WalletTransactionType;
    status: WalletTransactionStatus;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reference: string;
    group?: Types.ObjectId;
    cycle?: Types.ObjectId;
    contribution?: Types.ObjectId;
    metadata?: Record<string, unknown>;
}
export declare const WalletTransactionSchema: import("mongoose").Schema<WalletTransaction, import("mongoose").Model<WalletTransaction, any, any, any, any, any, WalletTransaction>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, WalletTransaction, Document<unknown, {}, WalletTransaction, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    wallet?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    user?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<WalletTransactionType, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<WalletTransactionStatus, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    amount?: import("mongoose").SchemaDefinitionProperty<number, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    balanceBefore?: import("mongoose").SchemaDefinitionProperty<number, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    balanceAfter?: import("mongoose").SchemaDefinitionProperty<number, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    reference?: import("mongoose").SchemaDefinitionProperty<string, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    group?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    cycle?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    contribution?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    metadata?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, WalletTransaction, Document<unknown, {}, WalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<WalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, WalletTransaction>;
