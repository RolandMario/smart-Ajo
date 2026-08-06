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
    purchaseAirtime(user: RequestUser, dto: PurchaseAirtimeDto): Promise<{
        commission: number;
    }>;
    purchaseData(user: RequestUser, dto: PurchaseDataDto): Promise<{
        commission: number;
    }>;
    purchaseCable(user: RequestUser, dto: PurchaseCableDto): Promise<{
        commission: number;
    }>;
    purchaseElectricity(user: RequestUser, dto: PurchaseElectricityDto): Promise<{
        commission: number;
    }>;
    getDataPlans(network?: string): Promise<{
        variationCode: string;
        name: string;
        amount: number;
        fixedPrice: boolean;
    }[]>;
    getCablePlans(provider?: string): Promise<{
        variationCode: string;
        name: string;
        amount: number;
        fixedPrice: boolean;
    }[]>;
    getHistory(user: RequestUser): Promise<never[]>;
}
