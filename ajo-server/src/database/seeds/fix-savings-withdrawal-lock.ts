/**
 * One-off script to release stuck savings-plan withdrawal locks.
 *
 * Background: `withdraw()` derives a deterministic reference per
 * (plan, cycleNumber) and stores it on `plan.lastWithdrawalReference` while
 * a Paystack transfer is in flight. If the withdrawal fails, `failWithdrawal`
 * clears that reference. A bug (fixed in savings.service.ts) crashed with a
 * duplicate-key error while recording the reconciled `_failed` audit entry,
 * which aborted the clear — leaving the plan permanently "withdrawal in
 * progress" even though no money ever left `savingsBalance`.
 *
 * Safe repair rule: if a plan still holds a `lastWithdrawalReference` but has
 * NO `saving_withdrawal` transaction for that reference, the money never moved,
 * so the lock is stale and can be cleared safely (the user may then retry).
 * If a `saving_withdrawal` DOES exist, the transfer succeeded and we leave the
 * plan alone (it should be finalized by completeWithdrawal).
 *
 * Run with:
 *   npm run seed:fix-savings-withdrawal-lock
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import {
  SavingPlanStatus,
  SavingTransactionType,
} from '../../common/enums/saving.enum';
import {
  SavingPlan,
  SavingPlanDocument,
} from '../../savings/schemas/saving-plan.schema';
import {
  SavingTransaction,
  SavingTransactionDocument,
} from '../../savings/schemas/saving-transaction.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const savingPlanModel = app.get<Model<SavingPlanDocument>>(
      getModelToken(SavingPlan.name),
    );
    const savingTxModel = app.get<Model<SavingTransactionDocument>>(
      getModelToken(SavingTransaction.name),
    );

    const stuckPlans = await savingPlanModel.find({
      lastWithdrawalReference: { $exists: true, $ne: null },
      status: {
        $in: [SavingPlanStatus.ACTIVE, SavingPlanStatus.COMPLETED],
      },
    });

    console.log(
      `Found ${stuckPlans.length} savings plan(s) with a withdrawal lock.`,
    );

    let cleared = 0;
    for (const plan of stuckPlans) {
      const reference = plan.lastWithdrawalReference!;

      const withdrawalTx = await savingTxModel.exists({
        plan: plan._id,
        reference,
        type: SavingTransactionType.SAVING_WITHDRAWAL,
      });

      if (withdrawalTx) {
        console.log(
          `  Keeping lock on ${plan._id.toString()} — a saving_withdrawal exists for ${reference}.`,
        );
        continue;
      }

      plan.lastWithdrawalReference = undefined;
      await plan.save();
      cleared += 1;
      console.log(
        `  Cleared stale withdrawal lock on ${plan._id.toString()} (${reference}). Savings balance is intact — the user can retry.`,
      );
    }

    console.log(`Repair complete. Cleared ${cleared} stale lock(s).`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
