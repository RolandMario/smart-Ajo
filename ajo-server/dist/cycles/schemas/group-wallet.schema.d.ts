import { Document, Types } from 'mongoose';
export type GroupWalletDocument = GroupWallet & Document;
export declare class GroupWallet {
    _id: Types.ObjectId;
    group: Types.ObjectId;
    balance: number;
}
export declare const GroupWalletSchema: import("mongoose").Schema<GroupWallet, import("mongoose").Model<GroupWallet, any, any, any, any, any, GroupWallet>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, GroupWallet, Document<unknown, {}, GroupWallet, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<GroupWallet & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupWallet, Document<unknown, {}, GroupWallet, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWallet & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    group?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, GroupWallet, Document<unknown, {}, GroupWallet, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWallet & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    balance?: import("mongoose").SchemaDefinitionProperty<number, GroupWallet, Document<unknown, {}, GroupWallet, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<GroupWallet & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, GroupWallet>;
