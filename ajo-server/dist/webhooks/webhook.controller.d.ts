import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaystackService } from '../payments/paystack.service';
import { WalletService } from '../wallet/wallet.service';
import { CyclesService } from '../cycles/cycles.service';
import { EscrowService } from '../cycles/escrow.service';
import { SavingsService } from '../savings/savings.service';
import { DonationsService } from '../donations/donations.service';
export declare class WebhookController {
    private paystack;
    private walletService;
    private cyclesService;
    private escrowService;
    private savingsService;
    private donationsService;
    private readonly logger;
    constructor(paystack: PaystackService, walletService: WalletService, cyclesService: CyclesService, escrowService: EscrowService, savingsService: SavingsService, donationsService: DonationsService);
    handleWebhook(req: RawBodyRequest<Request>, signature: string | undefined): {
        received: boolean;
    };
    private processEvent;
    private handleChargeSuccess;
    private extractEscrowIdentifiers;
    private handleTransferSuccess;
    private handleTransferFailed;
    private handleTransferReversed;
}
