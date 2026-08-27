import { OnModuleInit } from '@nestjs/common';
import { Connection, Model } from 'mongoose';
import { VTPassService } from '../payments/vtpass.service';
import { GladTidingsService } from '../payments/gladtidings.service';
import { WalletService } from '../wallet/wallet.service';
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
}
export declare class BillsService implements OnModuleInit {
    private vtpass;
    private gladtidings;
    private walletService;
    private usersService;
    private notificationsService;
    private connection;
    private providerConfigModel;
    private servicePlanModel;
    private billTransactionModel;
    private readonly logger;
    constructor(vtpass: VTPassService, gladtidings: GladTidingsService, walletService: WalletService, usersService: UsersService, notificationsService: NotificationsService, connection: Connection, providerConfigModel: Model<BillProviderConfigDocument>, servicePlanModel: Model<BillServicePlanDocument>, billTransactionModel: Model<BillTransactionDocument>);
    onModuleInit(): Promise<void>;
    private getPlatformAdminUserId;
    private resolveProvider;
    private vtpassCatalog;
    private readonly DISCO_SERVICE_ID_MAP;
    validateMeter(disco: string, meterNumber: string, meterType: string): Promise<{
        valid: boolean;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
    }>;
    validateSmartCard(serviceProvider: string, smartCardNumber: string): Promise<{
        valid: boolean;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
    }>;
    private executeBillTransaction;
    purchaseAirtime(userId: string, dto: {
        amount: number;
        phone: string;
        network: string;
    }): Promise<BillReceipt>;
    purchaseData(userId: string, dto: {
        phone: string;
        dataPlanId: string;
        network: string;
    }): Promise<BillReceipt>;
    purchaseCable(userId: string, dto: {
        serviceProvider: string;
        smartCardNumber: string;
        amount: number;
        variationCode?: string;
        customerName?: string;
    }): Promise<BillReceipt>;
    purchaseElectricity(userId: string, dto: {
        disco: string;
        meterNumber: string;
        meterType: string;
        amount: number;
        phone: string;
        customerName?: string;
    }): Promise<BillReceipt>;
    getDataPlans(network: string): Promise<import("../payments/vtpass.service").ServiceVariation[]>;
    getCablePlans(provider: string): Promise<import("../payments/vtpass.service").ServiceVariation[]>;
    getActiveServiceTypes(): Promise<string[]>;
    listProviderConfigs(): Promise<{
        serviceType: "data" | "airtime" | "cable" | "electricity";
        activeProvider: import("../payments/gladtidings.service").BillProviderKey;
        lastSyncedAt: Date | undefined;
        lastSyncStatus: string;
        planTotal: number;
        planActive: number;
        configured: boolean;
    }[]>;
    setProvider(serviceType: string, provider: 'vtpass' | 'gladtidings'): Promise<{
        serviceType: "data" | "airtime" | "cable" | "electricity";
        activeProvider: import("../payments/gladtidings.service").BillProviderKey;
        lastSyncedAt: Date | undefined;
        lastSyncStatus: string;
        planTotal: number;
        planActive: number;
        configured: boolean;
    }[]>;
    syncPlans(serviceType: string): Promise<{
        serviceType: string;
        provider: "vtpass" | "gladtidings";
        total: number;
        created: number;
        updated: number;
        removed: number;
    }>;
    listPlansAdmin(query?: {
        serviceType?: string;
        provider?: string;
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
    private toBillReceipt;
    getHistory(userId: string): Promise<BillReceipt[]>;
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
