import { Document, Types } from 'mongoose';
import { GroupWalletTransactionType } from '../../common/enums/wallet.enum';
export type GroupWalletTransactionDocument = GroupWalletTransaction & Document;
export declare class GroupWalletTransaction {
    _id: Types.ObjectId;
    groupWallet: Types.ObjectId;
    group: Types.ObjectId;
    type: GroupWalletTransactionType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    cycle?: Types.ObjectId;
    contribution?: Types.ObjectId;
    payout?: Types.ObjectId;
}
export declare const GroupWalletTransactionSchema: import("mongoose").Schema<GroupWalletTransaction, import("mongoose").Model<GroupWalletTransaction, any, any, any, any, any, GroupWalletTransaction>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    groupWallet?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    group?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    type?: import("mongoose").SchemaDefinitionProperty<GroupWalletTransactionType, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    amount?: import("mongoose").SchemaDefinitionProperty<number, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    balanceBefore?: import("mongoose").SchemaDefinitionProperty<number, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    balanceAfter?: import("mongoose").SchemaDefinitionProperty<number, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    cycle?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    contribution?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    payout?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId | undefined, GroupWalletTransaction, Document<unknown, {}, GroupWalletTransaction, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWalletTransaction & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, GroupWalletTransaction>;
