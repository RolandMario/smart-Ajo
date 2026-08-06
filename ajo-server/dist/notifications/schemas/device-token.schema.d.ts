import { Document, Types } from 'mongoose';
export type DeviceTokenDocument = DeviceToken & Document;
export declare class DeviceToken {
    _id: Types.ObjectId;
    user: Types.ObjectId;
    token: string;
    platform?: string;
    isActive: boolean;
}
export declare const DeviceTokenSchema: import("mongoose").Schema<DeviceToken, import("mongoose").Model<DeviceToken, any, any, any, any, any, DeviceToken>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, DeviceToken, Document<unknown, {}, DeviceToken, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    _id?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    user?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    token?: import("mongoose").SchemaDefinitionProperty<string, DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    platform?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    isActive?: import("mongoose").SchemaDefinitionProperty<boolean, DeviceToken, Document<unknown, {}, DeviceToken, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeviceToken & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, DeviceToken>;
