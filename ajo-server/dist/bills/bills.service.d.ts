import { Connection, Model } from 'mongoose';
import { VTPassService } from '../payments/vtpass.service';
import { WalletService } from '../wallet/wallet.service';
import type { BillPaymentSource } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { BillProviderConfigDocument } from './schemas/bill-provider-config.schema';
import { BillServicePlanDocument } from './schemas/bill-service-plan.schema';
import { BillTransactionDocument } from './schemas/bill-transaction.schema';
export interface BillReceipt {
    _id: string;
    user: string;
    type: string;
    status: 'success';
    amount: number;
    reference: string;
    externalReference?: string;
    provider: string;
    recipient: string;
    metadata?: Record<string, unknown>;
    walletTransaction?: string;
    createdAt?: string;
}
export declare class BillsService {
    private vtpass;
    private walletService;
    private usersService;
    private notificationsService;
    private connection;
    private providerConfigModel;
    private servicePlanModel;
    private billTransactionModel;
    private readonly logger;
    private readonly catalogueCache;
    constructor(vtpass: VTPassService, walletService: WalletService, usersService: UsersService, notificationsService: NotificationsService, connection: Connection, providerConfigModel: Model<BillProviderConfigDocument>, servicePlanModel: Model<BillServicePlanDocument>, billTransactionModel: Model<BillTransactionDocument>);
    private assertBillsConfigured;
    private getPlatformAdminUserId;
    private planCashbackPercent;
    private vtpassCatalog;
    private readonly DISCO_SERVICE_ID_MAP;
    private resolveLiveCablePlan;
    validateMeter(disco: string, meterNumber: string, meterType: string): Promise<{
        valid: boolean;
        name: string | undefined;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
        meterType: string;
    }>;
    validateSmartCard(serviceProvider: string, smartCardNumber: string): Promise<{
        valid: boolean;
        name: string | undefined;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
    }>;
    private toValidationResult;
    private executeBillTransaction;
    purchaseAirtime(userId: string, dto: {
        amount: number;
        phone: string;
        network: string;
        paymentSource?: BillPaymentSource;
    }): Promise<BillReceipt>;
    purchaseData(userId: string, dto: {
        phone: string;
        dataPlanId: string;
        network: string;
        paymentSource?: BillPaymentSource;
    }): Promise<BillReceipt>;
    purchaseCable(userId: string, dto: {
        serviceProvider: string;
        smartCardNumber: string;
        variationCode: string;
        customerName?: string;
        paymentSource?: BillPaymentSource;
    }): Promise<BillReceipt>;
    renewCable(userId: string, dto: {
        serviceProvider: string;
        smartCardNumber: string;
        customerName?: string;
        expectedAmount?: number;
        paymentSource?: BillPaymentSource;
    }): Promise<BillReceipt>;
    purchaseElectricity(userId: string, dto: {
        disco: string;
        meterNumber: string;
        meterType: string;
        amount: number;
        phone?: string;
        customerName?: string;
        paymentSource?: BillPaymentSource;
    }): Promise<BillReceipt>;
    private dataNetworkEntry;
    private cableProviderEntry;
    private liveCatalogue;
    private planOverlay;
    private liveDataPlans;
    private liveCablePlans;
    private matchCurrentBouquet;
    private resolveLiveDataPlan;
    getDataPlans(network: string): Promise<{
        variationCode: string;
        name: string;
        amount: number;
        fixedPrice: boolean;
        cashbackPercent: number;
        cashback: number;
    }[]>;
    getCablePlans(provider: string): Promise<{
        variationCode: string;
        name: string;
        amount: number;
        fixedPrice: boolean;
        cashbackPercent: number;
        cashback: number;
    }[]>;
    estimateCashback(params: {
        serviceType: 'airtime' | 'data' | 'cable' | 'electricity';
        provider?: string;
        variationCode?: string;
        amount?: number;
        packageName?: string;
    }): Promise<{
        serviceType: "data" | "airtime" | "cable" | "electricity";
        purchaseAmount: number;
        cashbackPercent: number;
        cashback: number;
    }>;
    getActiveServiceTypes(): Promise<string[]>;
    listCatalogStatus(): Promise<{
        serviceType: "data" | "airtime" | "cable" | "electricity";
        lastSyncedAt: Date | undefined;
        lastSyncStatus: string;
        planTotal: number;
        planActive: number;
        configured: boolean;
    }[]>;
    syncPlans(serviceType: string): Promise<{
        serviceType: string;
        provider: string;
        total: number;
        created: number;
        updated: number;
        removed: number;
    }>;
    listPlansAdmin(query?: {
        serviceType?: string;
        bucket?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        plans: {
            id: string;
            serviceType: string;
            provider: string;
            externalId: string;
            name: string;
            bucket: string;
            amount: number;
            fixedPrice: boolean;
            isActive: boolean;
            cashbackPercent: number;
            updatedAt: Date | undefined;
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    setPlanActive(id: string, isActive: boolean): Promise<{
        id: string;
        serviceType: string;
        name: string;
        isActive: boolean;
    }>;
    setPlanCashback(id: string, cashbackPercent: number): Promise<{
        id: string;
        serviceType: string;
        name: string;
        bucket: string;
        cashbackPercent: number;
    }>;
    private toBillReceipt;
    getHistory(userId: string, query?: {
        serviceType?: string;
    }): Promise<BillReceipt[]>;
    getReceipt(userId: string, reference: string): Promise<BillReceipt>;
    private toAdminBillTransaction;
    listTransactionsAdmin(query?: {
        serviceType?: string;
        status?: string;
        userId?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        transactions: {
            id: string;
            user: {
                id: string;
                name: string | undefined;
                phone: string;
            };
            type: string;
            status: string;
            amount: number;
            reference: string;
            externalReference: string | undefined;
            provider: string;
            recipient: string;
            metadata: Record<string, unknown> | undefined;
            walletTransaction: string | undefined;
            createdAt: Date | undefined;
            updatedAt: Date | undefined;
        }[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    }>;
    getReceiptAdmin(id: string): Promise<{
        id: string;
        user: {
            id: string;
            name: string | undefined;
            phone: string;
        };
        type: string;
        status: string;
        amount: number;
        reference: string;
        externalReference: string | undefined;
        provider: string;
        recipient: string;
        metadata: Record<string, unknown> | undefined;
        walletTransaction: string | undefined;
        createdAt: Date | undefined;
        updatedAt: Date | undefined;
    }>;
}
