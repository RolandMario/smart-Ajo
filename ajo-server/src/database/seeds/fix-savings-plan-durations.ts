/**
 * One-off script to backfill the required `durationUnit` / `durationValue`
 * fields on savings plans created before those fields existed (legacy plans
 * only carry the nominal `durationMonths`). Without this, the auto-collect
 * scheduler's `plan.save()` fails validation for those documents ("Path
 * `durationValue` is required" / "Path `durationUnit` is required") and the
 * plan never progresses.
 *
 * Run with:
 *
 *   npm run seed:fix-savings-plan-durations
 *
 * New plans always set both fields, so this only touches documents missing at
 * least one of them. `durationValue` is derived from each plan's existing
 * `durationMonths`, falling back to 3 for plans that have neither.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { SavingDurationUnit } from '../../common/enums/saving.enum';
import {
  SavingPlan,
  SavingPlanDocument,
} from '../../savings/schemas/saving-plan.schema';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const savingPlanModel = app.get<Model<SavingPlanDocument>>(
      getModelToken(SavingPlan.name),
    );

    const legacyPlans = await savingPlanModel.find({
      $or: [
        { durationUnit: { $exists: false } },
        { durationValue: { $exists: false } },
      ],
    });

    console.log(
      `Found ${legacyPlans.length} savings plan(s) missing duration fields.`,
    );

    let updated = 0;
    for (const plan of legacyPlans) {
      plan.durationUnit ??= SavingDurationUnit.MONTHS;
      plan.durationValue ??= plan.durationMonths ?? 3;
      await plan.save();
      updated += 1;
      console.log(
        `  Plan ${plan._id.toString()} → durationUnit=${plan.durationUnit}, durationValue=${plan.durationValue}`,
      );
    }

    console.log(`Migration complete. Backfilled ${updated} savings plan(s).`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
