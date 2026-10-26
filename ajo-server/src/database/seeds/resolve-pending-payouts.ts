/**
 * One-off script to resolve payouts that were initiated before the
 * test-mode OTP auto-resolution was implemented. These payouts are stuck
 * in PENDING status because the Paystack webhook never arrived (test mode
 * requires OTP resolution).
 *
 * Run with:
 *
 *   npm run seed:resolve-pending-payouts
 *
 * This script:
 *  1. Finds all Payouts with status 'pending' that have a paystackTransferCode
 *  2. Attempts to resolve the OTP with test OTP "123456"
 *  3. If OTP resolution fails (e.g. 404 — transfer already expired), it
 *     finalizes the payout directly since we're in test mode and no real
 *     money is at stake
 *
 * The same reconciliation is applied to pool donation payouts
 * (DonationPayout), which are finalised through `DonationsService`.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PaystackService } from '../../payments/paystack.service';
import { CyclesService } from '../../cycles/cycles.service';
import { DonationsService } from '../../donations/donations.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payout, PayoutDocument } from '../../cycles/schemas/payout.schema';
import { Cycle, CycleDocument } from '../../cycles/schemas/cycle.schema';
import { GroupDocument } from '../../groups/schemas/group.schema';
import {
  DonationPayout,
  DonationPayoutDocument,
} from '../../donations/schemas/donation-payout.schema';
import { TransferStatus } from '../../common/enums/wallet.enum';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const paystack = app.get(PaystackService);

    if (!paystack.isTestMode()) {
      console.log(
        'Not in test mode (PAYSTACK_SECRET_KEY does not start with sk_test_). Aborting.',
      );
      process.exitCode = 0;
      return;
    }

    const payoutModel = app.get<Model<PayoutDocument>>(
      getModelToken(Payout.name),
    );
    const cycleModel = app.get<Model<CycleDocument>>(getModelToken(Cycle.name));
    const groupModel = app.get<Model<GroupDocument>>(getModelToken('Group'));
    const cyclesService = app.get(CyclesService);
    const donationPayoutModel = app.get<Model<DonationPayoutDocument>>(
      getModelToken(DonationPayout.name),
    );
    const donationsService = app.get(DonationsService);

    const pendingPayouts = await payoutModel.find({
      status: TransferStatus.PENDING,
    });

    console.log(`Found ${pendingPayouts.length} pending payout(s).`);

    for (const payoutDoc of pendingPayouts) {
      if (!payoutDoc.paystackTransferCode) {
        console.log(
          `  Skipping payout ${payoutDoc._id.toString()} — no paystackTransferCode`,
        );
        continue;
      }

      const cycle = await cycleModel.findById(payoutDoc.cycle);
      const group = await groupModel.findById(payoutDoc.group);

      if (!cycle) {
        console.log(
          `  Skipping payout ${payoutDoc._id.toString()} — cycle ${payoutDoc.cycle.toString()} not found`,
        );
        continue;
      }

      if (!group) {
        console.log(
          `  Skipping payout ${payoutDoc._id.toString()} — group ${payoutDoc.group.toString()} not found`,
        );
        continue;
      }

      console.log(
        `  Resolving OTP for payout ${payoutDoc._id.toString()} (transfer: ${payoutDoc.paystackTransferCode})...`,
      );

      try {
        await paystack.resolveOtp(
          payoutDoc.paystackTransferCode,
          paystack.testTransferOtp(),
        );
        console.log(`  OTP resolved successfully.`);
      } catch (err) {
        console.warn(
          `  OTP resolution failed (${String(err)}). This is expected if the transfer already expired. Finalizing directly since we're in test mode.`,
        );
      }

      console.log(`  Finalizing payout ${payoutDoc._id.toString()}...`);

      try {
        await cyclesService.finalizeSuccessfulPayout(payoutDoc, cycle, group);
        console.log(
          `  ✅ Payout ${payoutDoc._id.toString()} finalized successfully.`,
        );
      } catch (err) {
        console.error(
          `  Failed to finalize payout ${payoutDoc._id.toString()}: ${String(err)}`,
        );
      }
    }

    // ---- Pool donation payouts ---------------------------------------------
    const pendingDonationPayouts = await donationPayoutModel.find({
      status: TransferStatus.PENDING,
    });

    console.log(
      `Found ${pendingDonationPayouts.length} pending pool donation payout(s).`,
    );

    for (const payoutDoc of pendingDonationPayouts) {
      if (!payoutDoc.paystackTransferCode) {
        console.log(
          `  Skipping pool payout ${payoutDoc._id.toString()} — no paystackTransferCode`,
        );
        continue;
      }

      console.log(
        `  Resolving OTP for pool payout ${payoutDoc._id.toString()} (transfer: ${payoutDoc.paystackTransferCode})...`,
      );

      try {
        await paystack.resolveOtp(
          payoutDoc.paystackTransferCode,
          paystack.testTransferOtp(),
        );
        console.log('  OTP resolved successfully.');
      } catch (err) {
        console.warn(
          `  OTP resolution failed (${String(err)}). Finalizing directly since we're in test mode.`,
        );
      }

      const handled = await donationsService.completePayout(
        payoutDoc.paystackReference,
      );
      console.log(
        handled
          ? `  ✅ Pool payout ${payoutDoc._id.toString()} finalized.`
          : `  Skipping pool payout ${payoutDoc._id.toString()} — already finalized.`,
      );
    }

    console.log('Done.');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
