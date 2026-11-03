import { BillsService } from './bills.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { PurchaseAirtimeDto } from './dto/purchase-airtime.dto';
import { PurchaseDataDto } from './dto/purchase-data.dto';
import { PurchaseCableDto } from './dto/purchase-cable.dto';
import { RenewCableDto } from './dto/renew-cable.dto';
import { PurchaseElectricityDto } from './dto/purchase-electricity.dto';
import { ValidateMeterDto, ValidateSmartCardDto } from './dto/validate.dto';
import { CashbackQuoteQueryDto } from './dto/cashback-quote-query.dto';
import { ListBillHistoryQueryDto } from './dto/list-bill-history-query.dto';
export declare class BillsController {
    private bills;
    constructor(bills: BillsService);
    validateMeter(user: RequestUser, dto: ValidateMeterDto): Promise<{
        valid: boolean;
        name: string | undefined;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
        meterType: string;
    }>;
    validateSmartCard(user: RequestUser, dto: ValidateSmartCardDto): Promise<{
        valid: boolean;
        name: string | undefined;
        customerName: string | undefined;
        address: string | undefined;
        packageInfo: string | undefined;
        outstanding: number | undefined;
    }>;
    purchaseAirtime(user: RequestUser, dto: PurchaseAirtimeDto): Promise<import("./bills.service").BillReceipt>;
    purchaseData(user: RequestUser, dto: PurchaseDataDto): Promise<import("./bills.service").BillReceipt>;
    purchaseCable(user: RequestUser, dto: PurchaseCableDto): Promise<import("./bills.service").BillReceipt>;
    renewCable(user: RequestUser, dto: RenewCableDto): Promise<import("./bills.service").BillReceipt>;
    purchaseElectricity(user: RequestUser, dto: PurchaseElectricityDto): Promise<import("./bills.service").BillReceipt>;
    getServices(): Promise<string[]>;
    getDataPlans(network?: string): Promise<{
        variationCode: string;
        name: string;
        amount: number;
        fixedPrice: boolean;
        cashbackPercent: number;
        cashback: number;
    }[]>;
    getCablePlans(provider?: string): Promise<{
        variationCode: string;
        name: string;
        amount: number;
        fixedPrice: boolean;
        cashbackPercent: number;
        cashback: number;
    }[]>;
    getCashbackQuote(query: CashbackQuoteQueryDto): Promise<{
        serviceType: "data" | "airtime" | "cable" | "electricity";
        purchaseAmount: number;
        cashbackPercent: number;
        cashback: number;
    }>;
    getHistory(user: RequestUser, query: ListBillHistoryQueryDto): Promise<import("./bills.service").BillReceipt[]>;
    getReceipt(user: RequestUser, reference: string): Promise<import("./bills.service").BillReceipt>;
}
