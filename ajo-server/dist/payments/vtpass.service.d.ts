import { ConfigService } from '@nestjs/config';
export interface PurchaseResult {
    requestId: string;
    externalTransactionId: string;
    status: string;
    commission: number;
    providerData?: Record<string, unknown>;
}
export interface VerifyProductResult {
    valid: boolean;
    name?: string;
    address?: string;
    packageInfo?: string;
    outstanding?: number;
    message?: string;
}
export interface ServiceVariation {
    variationCode: string;
    name: string;
    amount: number;
    fixedPrice: boolean;
}
export interface QueryTransactionResult {
    status: string;
    externalTransactionId?: string;
}
export declare class VTPassService {
    private configService;
    private readonly logger;
    private readonly client;
    private readonly apiKey?;
    private readonly publicKey?;
    private readonly secretKey?;
    constructor(configService: ConfigService);
    isConfigured(): boolean;
    missingConfig(): string[];
    private readKey;
    private assertConfigured;
    private authHeaders;
    private getRequestId;
    private isSuccessResponse;
    private isDelivered;
    private describeFailure;
    private toFailureException;
    private handleError;
    private toPurchaseResult;
    private submitPurchase;
    private fetchRequery;
    private requeryForToken;
    purchaseAirtime(params: {
        serviceID: string;
        phone: string;
        amount: number;
    }): Promise<PurchaseResult>;
    purchaseData(params: {
        serviceID: string;
        phone: string;
        variationCode: string;
    }): Promise<PurchaseResult>;
    purchaseCable(params: {
        serviceID: string;
        billersCode: string;
        amount: number;
        phone: string;
        variationCode?: string;
        renewCurrentBouquet?: boolean;
    }): Promise<PurchaseResult>;
    purchaseElectricity(params: {
        serviceID: string;
        billersCode: string;
        amount: number;
        phone: string;
        variationCode: string;
    }): Promise<PurchaseResult>;
    verifyProduct(params: {
        serviceID: string;
        billersCode: string;
    }): Promise<VerifyProductResult>;
    getServiceVariations(serviceID: string): Promise<ServiceVariation[]>;
    queryTransaction(requestId: string): Promise<QueryTransactionResult>;
}
