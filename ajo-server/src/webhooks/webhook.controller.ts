import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaystackService } from '../payments/paystack.service';
import { WalletService } from '../wallet/wallet.service';
import { CyclesService } from '../cycles/cycles.service';
import { SavingsService } from '../savings/savings.service';
import { TransferStatus } from '../common/enums/wallet.enum';

interface PaystackWebhookEvent {
  event: string;
  data: Record<string, unknown>;
}

/**
 * Receives and processes Paystack webhook events.
 *
 * IMPORTANT: NestJS must be configured to expose the raw request body so
 * the HMAC signature can be verified. See main.ts for the bodyParser
 * configuration that enables this.
 *
 * Events handled:
 *  - charge.success   -> credit the member's wallet (card top-up, or a bank
 *                        transfer into their Dedicated Virtual Account)
 *  - transfer.success -> finalize the cycle payout (mark recipient
 *                        COLLECTED, advance rotation)
 *  - transfer.failed  -> refund the group wallet; payout can be retried
 *  - transfer.reversed-> refund the group wallet
 */
@Controller('webhooks/paystack')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private paystack: PaystackService,
    private walletService: WalletService,
    private cyclesService: CyclesService,
    private savingsService: SavingsService,
  ) {}

  @Post()
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string | undefined,
  ): { received: boolean } {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException(
        'Missing raw body — check bodyParser configuration',
      );
    }

    const isValid = this.paystack.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      this.logger.warn('Paystack webhook rejected: invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as PaystackWebhookEvent;

    this.logger.log(`Received Paystack webhook: ${event.event}`);

    // Handle asynchronously — return 200 immediately so Paystack doesn't
    // retry, then process in the background.
    setImmediate(() => {
      void this.processEvent(event);
    });

    return { received: true };
  }

  private async processEvent(event: PaystackWebhookEvent): Promise<void> {
    try {
      switch (event.event) {
        case 'charge.success':
          await this.handleChargeSuccess(event.data);
          break;

        case 'transfer.success':
          await this.handleTransferSuccess(event.data);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(event.data);
          break;

        case 'transfer.reversed':
          await this.handleTransferReversed(event.data);
          break;

        default:
          this.logger.debug(`Unhandled Paystack event type: ${event.event}`);
      }
    } catch (err) {
      this.logger.error(
        `Error processing Paystack event ${event.event}: ${String(err)}`,
      );
    }
  }

  // ---- charge.success --------------------------------------------------------

  private async handleChargeSuccess(
    data: Record<string, unknown>,
  ): Promise<void> {
    const reference = data.reference as string | undefined;
    const amount = data.amount as number | undefined; // kobo

    if (!reference || !amount || amount <= 0) {
      this.logger.warn('charge.success missing reference or amount');
      return;
    }

    const amountNaira = amount / 100;

    // 1. Card top-up path: reconciles against a PENDING FUNDING ledger
    // entry created by POST /wallet/fund/initialize.
    const processedCard = await this.walletService.confirmFunding(
      reference,
      amountNaira,
      {
        source: 'webhook',
        paystackData: data,
      },
    );

    if (processedCard) {
      this.logger.log(
        `Wallet funded via webhook: ref=${reference}, amount=${amountNaira} NGN`,
      );
      return;
    }

    // 2. Dedicated Virtual Account path: an inbound bank transfer into a
    // member's personal account number. There is no PENDING ledger entry —
    // the funds already settled — so we credit the wallet directly,
    // matching the member by the phone attached to the Paystack customer.
    const customer =
      (data.customer as Record<string, unknown> | undefined) ?? {};
    const phone = customer.phone as string | undefined;

    if (!phone) {
      this.logger.warn(
        `charge.success ref=${reference}: no matching wallet top-up and no customer phone — skipping`,
      );
      return;
    }

    const credited = await this.walletService.creditDedicatedAccountFunding({
      phone,
      amountNaira,
      reference,
      paystackData: data,
    });

    this.logger.log(
      credited
        ? `Wallet funded via dedicated account: ref=${reference}, amount=${amountNaira} NGN`
        : `charge.success ref=${reference}: already credited or unknown customer — skipping`,
    );
  }

  // ---- transfer.success ------------------------------------------------------

  private async handleTransferSuccess(
    data: Record<string, unknown>,
  ): Promise<void> {
    const reference = data.reference as string | undefined;

    if (!reference) {
      this.logger.warn('transfer.success missing reference');
      return;
    }

    const payout = await this.cyclesService.findPayoutByReference(reference);

    if (!payout) {
      // Not a cycle payout — check for an individual savings withdrawal.
      const savingPlan =
        await this.savingsService.findSavingPlanByWithdrawalReference(
          reference,
        );
      if (savingPlan) {
        this.logger.log(
          `Savings withdrawal finalized via webhook: ref=${reference}`,
        );
        await this.savingsService.completeWithdrawal(reference);
        return;
      }

      this.logger.warn(
        `transfer.success: no payout found for reference ${reference}`,
      );
      return;
    }

    if (payout.status === TransferStatus.SUCCESS) {
      this.logger.log(
        `transfer.success: payout ${payout._id.toString()} already finalized — skipping`,
      );
      return;
    }

    const cycle = await this.cyclesService.findCycleById(payout.cycle);

    if (!cycle) {
      this.logger.error(
        `transfer.success: cycle ${payout.cycle.toString()} not found`,
      );
      return;
    }

    const group = await this.cyclesService.findGroupById(payout.group);

    if (!group) {
      this.logger.error(
        `transfer.success: group ${payout.group.toString()} not found`,
      );
      return;
    }

    await this.cyclesService.finalizeSuccessfulPayout(payout, cycle, group);

    this.logger.log(
      `Payout finalized via webhook: ref=${reference}, payout=${payout._id.toString()}`,
    );
  }

  // ---- transfer.failed -------------------------------------------------------

  private async handleTransferFailed(
    data: Record<string, unknown>,
  ): Promise<void> {
    const reference = data.reference as string | undefined;

    if (!reference) {
      this.logger.warn('transfer.failed missing reference');
      return;
    }

    const payout = await this.cyclesService.findPayoutByReference(reference);

    if (!payout) {
      // Not a cycle payout — check for an individual savings withdrawal.
      const savingPlan =
        await this.savingsService.findSavingPlanByWithdrawalReference(
          reference,
        );
      if (savingPlan) {
        const reason = (data.reason as string | undefined) ?? 'Transfer failed';
        this.logger.warn(
          `Savings withdrawal failed via webhook: ref=${reference}, reason=${reason}`,
        );
        await this.savingsService.failWithdrawal(reference, reason);
      } else {
        this.logger.warn(
          `transfer.failed: no payout found for reference ${reference}`,
        );
      }
      return;
    }

    if (payout.status !== TransferStatus.PENDING) {
      return; // Already handled
    }

    const reason = (data.reason as string | undefined) ?? 'Transfer failed';

    await this.cyclesService.handleFailedPayout(
      payout,
      payout.group,
      payout.cycle,
      reason,
    );

    this.logger.warn(
      `Payout failed via webhook: ref=${reference}, reason=${reason}`,
    );
  }

  // ---- transfer.reversed -----------------------------------------------------

  private async handleTransferReversed(
    data: Record<string, unknown>,
  ): Promise<void> {
    const reference = data.reference as string | undefined;

    if (!reference) return;

    const payout = await this.cyclesService.findPayoutByReference(reference);

    if (!payout) {
      // Not a cycle payout — check for an individual savings withdrawal.
      const savingPlan =
        await this.savingsService.findSavingPlanByWithdrawalReference(
          reference,
        );
      if (savingPlan) {
        this.logger.warn(
          `Savings withdrawal reversed via webhook: ref=${reference}`,
        );
        await this.savingsService.failWithdrawal(reference, 'Reversed');
      }
      return;
    }

    const group = await this.cyclesService.findGroupById(payout.group);

    if (!group) return;

    await this.cyclesService.handleReversedPayout(payout, group);

    this.logger.warn(`Payout reversed via webhook: ref=${reference}`);
  }
}
