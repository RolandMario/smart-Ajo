import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaystackService } from '../payments/paystack.service';
import { WalletService } from '../wallet/wallet.service';
import { CyclesService } from '../cycles/cycles.service';
import { SavingsService } from '../savings/savings.service';
export declare class WebhookController {
    private paystack;
    private walletService;
    private cyclesService;
    private savingsService;
    private readonly logger;
    constructor(paystack: PaystackService, walletService: WalletService, cyclesService: CyclesService, savingsService: SavingsService);
    handleWebhook(req: RawBodyRequest<Request>, signature: string | undefined): {
        received: boolean;
    };
    private processEvent;
    private handleChargeSuccess;
    private handleTransferSuccess;
    private handleTransferFailed;
    private handleTransferReversed;
}
