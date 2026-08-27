import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { BankAccount } from './schemas/bank-account.schema';
import { Role } from '../common/enums/role.enum';
export declare class UsersService {
    private userModel;
    constructor(userModel: Model<UserDocument>);
    findByPhone(phone: string): import("mongoose").Query<(import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null, import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }, {}, UserDocument, "findOne", {}>;
    findByEmail(email: string): import("mongoose").Query<(import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null, import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }, {}, UserDocument, "findOne", {}>;
    findById(id: string): import("mongoose").Query<(import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null, import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }, {}, UserDocument, "findOne", {}>;
    findByIds(ids: (string | Types.ObjectId)[]): Promise<Array<{
        _id: Types.ObjectId;
        name?: string;
        phone: string;
    }>>;
    findOrCreateByPhone(phone: string): Promise<UserDocument>;
    create(params: {
        phone: string;
        email: string;
        passwordHash: string;
        role: Role;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
    }): Promise<UserDocument>;
    setBankAccount(userId: string, bankAccount: BankAccount): Promise<UserDocument>;
    createPlatformAdmin(params: {
        phone: string;
        email: string;
        passwordHash: string;
        name?: string;
    }): Promise<UserDocument>;
    findPlatformAdmin(): Promise<UserDocument>;
}
