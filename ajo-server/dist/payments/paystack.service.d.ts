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
export interface CreateCustomerResult {
    customerCode: string;
}
export interface PaystackCustomerResult {
    customerCode: string;
    email?: string;
    phone?: string;
}
export interface DedicatedAccountResult {
    accountId?: string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    currency: string;
    active: boolean;
}
export interface InitiateTransferResult {
    transferCode: string;
    status: string;
}
export declare const PAYSTACK_NOT_CONFIGURED_MESSAGE: string;
export declare class PaystackService {
    private configService;
    private readonly logger;
    private readonly client;
    private readonly secretKey;
    private readonly DVA_BANK_POOL;
    private providerCache?;
    constructor(configService: ConfigService);
    private normalizeSecret;
    isConfigured(): boolean;
    assertConfigured(): void;
    private isInvalidKeyError;
    private errorMessage;
    isCustomerNotFoundError(error: unknown): boolean;
    isDuplicateCustomerError(error: unknown): boolean;
    isDedicatedAccountExistsError(error: unknown): boolean;
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
    createCustomer(params: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        metadata?: Record<string, unknown>;
    }): Promise<CreateCustomerResult>;
    fetchCustomer(customerCode: string): Promise<PaystackCustomerResult | null>;
    fetchCustomerByEmail(email: string): Promise<PaystackCustomerResult | null>;
    dvaPreferredBank(): string;
    fetchDedicatedAccountProviders(): Promise<string[]>;
    dvaBankCandidates(available?: string[], preferred?: string): string[];
    private isDvaBankUnavailableError;
    createDedicatedAccount(params: {
        customerCode: string;
        preferredBank: string;
        phone: string;
        firstName?: string;
        lastName?: string;
    }): Promise<DedicatedAccountResult>;
    private requestDedicatedAccount;
    private mapDedicatedAccount;
    fetchDedicatedAccounts(customerCode: string): Promise<DedicatedAccountResult[]>;
    deactivateDedicatedAccount(accountId: string): Promise<void>;
    initiateTransfer(params: {
        amountNaira: number;
        recipientCode: string;
        reason: string;
        reference: string;
    }): Promise<InitiateTransferResult>;
    isTestMode(): boolean;
    keyMode(): 'test' | 'live';
    testTransferOtp(): string;
    resolveOtp(transferCode: string, otp: string): Promise<{
        status: string;
    }>;
    verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
}
