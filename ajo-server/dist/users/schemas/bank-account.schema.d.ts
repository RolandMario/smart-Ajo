export declare class BankAccount {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    paystackRecipientCode: string;
}
export declare const BankAccountSchema: import("mongoose").Schema<BankAccount, import("mongoose").Model<BankAccount, any, any, any, any, any, BankAccount>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, BankAccount, import("mongoose").Document<unknown, {}, BankAccount, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<BankAccount & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    bankCode?: import("mongoose").SchemaDefinitionProperty<string, BankAccount, import("mongoose").Document<unknown, {}, BankAccount, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BankAccount & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    bankName?: import("mongoose").SchemaDefinitionProperty<string, BankAccount, import("mongoose").Document<unknown, {}, BankAccount, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BankAccount & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    accountNumber?: import("mongoose").SchemaDefinitionProperty<string, BankAccount, import("mongoose").Document<unknown, {}, BankAccount, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BankAccount & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    accountName?: import("mongoose").SchemaDefinitionProperty<string, BankAccount, import("mongoose").Document<unknown, {}, BankAccount, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BankAccount & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    paystackRecipientCode?: import("mongoose").SchemaDefinitionProperty<string, BankAccount, import("mongoose").Document<unknown, {}, BankAccount, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<BankAccount & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, BankAccount>;
