import { Document } from 'mongoose';
export type OtpDocument = Otp & Document;
export declare enum OtpPurpose {
    LOGIN_OR_REGISTER = "login_or_register"
}
export declare class Otp {
    phone: string;
    codeHash: string;
    purpose?: OtpPurpose;
    expiresAt: Date;
    consumed?: boolean;
    attempts?: number;
}
export declare const OtpSchema: import("mongoose").Schema<Otp, import("mongoose").Model<Otp, any, any, any, any, any, Otp>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Otp, Document<unknown, {}, Otp, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    phone?: import("mongoose").SchemaDefinitionProperty<string, Otp, Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    codeHash?: import("mongoose").SchemaDefinitionProperty<string, Otp, Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    purpose?: import("mongoose").SchemaDefinitionProperty<OtpPurpose | undefined, Otp, Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    expiresAt?: import("mongoose").SchemaDefinitionProperty<Date, Otp, Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    consumed?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Otp, Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    attempts?: import("mongoose").SchemaDefinitionProperty<number | undefined, Otp, Document<unknown, {}, Otp, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Otp & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Otp>;
