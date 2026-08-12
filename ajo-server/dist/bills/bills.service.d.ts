import { Connection } from 'mongoose';
import { VTPassService } from '../payments/vtpass.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
export declare class BillsService {
    private vtpass;
    private walletService;
    private usersService;
    private notificationsService;
    private connection;
    private readonly logger;
    constructor(vtpass: VTPassService, walletService: WalletService, usersService: UsersService, notificationsService: NotificationsService, connection: Connection);
    private getPlatformAdminUserId;
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
    }): Promise<{
        commission: number;
    }>;
    purchaseData(userId: string, dto: {
        phone: string;
        dataPlanId: string;
        network: string;
    }): Promise<{
        commission: number;
    }>;
    purchaseCable(userId: string, dto: {
        serviceProvider: string;
        smartCardNumber: string;
        amount: number;
        variationCode?: string;
    }): Promise<{
        commission: number;
    }>;
    purchaseElectricity(userId: string, dto: {
        disco: string;
        meterNumber: string;
        meterType: string;
        amount: number;
        phone: string;
    }): Promise<{
        commission: number;
    }>;
    getDataPlans(network: string): Promise<import("../payments/vtpass.service").ServiceVariation[]>;
    getCablePlans(provider: string): Promise<import("../payments/vtpass.service").ServiceVariation[]>;
    getHistory(userId: string): Promise<never[]>;
}
