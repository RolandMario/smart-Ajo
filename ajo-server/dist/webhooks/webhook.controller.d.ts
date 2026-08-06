import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaystackService } from '../payments/paystack.service';
import { WalletService } from '../wallet/wallet.service';
import { CyclesService } from '../cycles/cycles.service';
export declare class WebhookController {
    private paystack;
    private walletService;
    private cyclesService;
    private readonly logger;
    constructor(paystack: PaystackService, walletService: WalletService, cyclesService: CyclesService);
    handleWebhook(req: RawBodyRequest<Request>, signature: string | undefined): {
        received: boolean;
    };
    private processEvent;
    private handleChargeSuccess;
    private handleTransferSuccess;
    private handleTransferFailed;
    private handleTransferReversed;
}
