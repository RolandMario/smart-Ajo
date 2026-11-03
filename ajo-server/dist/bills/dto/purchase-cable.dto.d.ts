export declare class PurchaseCableDto {
    serviceProvider: string;
    smartCardNumber: string;
    amount?: number;
    variationCode: string;
    customerName?: string;
    paymentSource?: 'main' | 'cashback';
}
