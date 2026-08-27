import { ConfigService } from '@nestjs/config';
export interface InitializeTransactionResult {
    authorizationUrl: string;
    accessCode: string;
    reference: string;
}
export interface VerifyTransactionResult {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paidAt?: string;
}
export interface ResolveAccountResult {
    accountNumber: string;
    accountName: string;
}
export interface TransferRecipientResult {
    recipientCode: string;
}
export interface BankListEntry {
    name: string;
    code: string;
}
export interface InitiateTransferResult {
    transferCode: string;
    status: string;
}
export declare class PaystackService {
    private configService;
    private readonly logger;
    private readonly client;
    private readonly secretKey;
    constructor(configService: ConfigService);
    private handleError;
    initializeTransaction(email: string, amountNaira: number, reference: string): Promise<InitializeTransactionResult>;
    verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
    listBanks(): Promise<BankListEntry[]>;
    resolveAccountNumber(accountNumber: string, bankCode: string): Promise<ResolveAccountResult>;
    createTransferRecipient(params: {
        accountNumber: string;
        bankCode: string;
        accountName: string;
    }): Promise<TransferRecipientResult>;
    initiateTransfer(params: {
        amountNaira: number;
        recipientCode: string;
        reason: string;
        reference: string;
    }): Promise<InitiateTransferResult>;
    isTestMode(): boolean;
    testTransferOtp(): string;
    resolveOtp(transferCode: string, otp: string): Promise<{
        status: string;
    }>;
    verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
}
