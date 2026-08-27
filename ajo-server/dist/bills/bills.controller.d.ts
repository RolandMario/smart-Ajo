import { BillsService } from './bills.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { PurchaseAirtimeDto } from './dto/purchase-airtime.dto';
import { PurchaseDataDto } from './dto/purchase-data.dto';
import { PurchaseCableDto } from './dto/purchase-cable.dto';
import { PurchaseElectricityDto } from './dto/purchase-electricity.dto';
import { ValidateMeterDto, ValidateSmartCardDto } from './dto/validate.dto';
export declare class BillsController {
    private bills;
    constructor(bills: BillsService);
    validateMeter(user: RequestUser, dto: ValidateMeterDto): Promise<{
        valid: boolean;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
    }>;
    validateSmartCard(user: RequestUser, dto: ValidateSmartCardDto): Promise<{
        valid: boolean;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
    }>;
    purchaseAirtime(user: RequestUser, dto: PurchaseAirtimeDto): Promise<import("./bills.service").BillReceipt>;
    purchaseData(user: RequestUser, dto: PurchaseDataDto): Promise<import("./bills.service").BillReceipt>;
    purchaseCable(user: RequestUser, dto: PurchaseCableDto): Promise<import("./bills.service").BillReceipt>;
    purchaseElectricity(user: RequestUser, dto: PurchaseElectricityDto): Promise<import("./bills.service").BillReceipt>;
    getServices(): Promise<string[]>;
    getDataPlans(network?: string): Promise<import("../payments/vtpass.service").ServiceVariation[]>;
    getCablePlans(provider?: string): Promise<import("../payments/vtpass.service").ServiceVariation[]>;
    getHistory(user: RequestUser): Promise<import("./bills.service").BillReceipt[]>;
    getReceipt(user: RequestUser, reference: string): Promise<import("./bills.service").BillReceipt>;
}
