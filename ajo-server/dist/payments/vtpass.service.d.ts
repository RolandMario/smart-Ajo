import { ConfigService } from '@nestjs/config';
export declare class VTPassService {
    private configService;
    private readonly logger;
    private readonly client;
    private readonly apiKey;
    private readonly publicKey;
    private readonly secretKey;
    private readonly baseURL;
    constructor(configService: ConfigService);
    private getAuthHeaders;
    private getRequestId;
    private handleError;
    purchaseAirtime(params: {
        serviceID: string;
        phone: string;
        amount: number;
    }): Promise<{
        requestId: string;
        externalTransactionId: string;
        status: string;
        commission: number;
    }>;
    purchaseData(params: {
        serviceID: string;
        phone: string;
        variationCode: string;
    }): Promise<{
        requestId: string;
        externalTransactionId: string;
        status: string;
        commission: number;
    }>;
    purchaseCable(params: {
        serviceID: string;
        billersCode: string;
        amount: number;
        phone: string;
    }): Promise<{
        requestId: string;
        externalTransactionId: string;
        status: string;
        commission: number;
    }>;
    purchaseElectricity(params: {
        serviceID: string;
        billerCode: string;
        amount: number;
        phone: string;
    }): Promise<{
        requestId: string;
        externalTransactionId: string;
        status: string;
        commission: number;
    }>;
    verifyProduct(params: {
        serviceID: string;
        billersCode: string;
    }): Promise<{
        valid: boolean;
        name?: string;
        address?: string;
        packageInfo?: string;
        outstanding?: number;
        message?: string;
    }>;
    getServiceVariations(serviceID: string): Promise<Array<{
        variationCode: string;
        name: string;
        amount: number;
        fixedPrice: boolean;
    }>>;
    queryTransaction(requestId: string): Promise<{
        status: string;
        externalTransactionId?: string;
    }>;
}
