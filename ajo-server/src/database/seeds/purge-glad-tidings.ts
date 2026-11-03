/**
 * One-off cleanup for the Gladtidings → VTpass consolidation.
 *
 * Bills used to be routable to a second VTU provider (Gladtidings). VTPass is
 * now the only provider, so this removes what the old routing left behind:
 *
 *  - every `BillServicePlan` with `provider: 'gladtidings'` (dead catalogue rows
 *    that would otherwise linger in the admin Plans screen), and
 *  - the `activeProvider` field on `BillProviderConfig` documents (the routing
 *    flag no longer exists; the documents now only track sync freshness).
 *
 * Dry run by default — pass `--confirm` to actually delete:
 *
 *   npm run seed:purge-glad-tidings               # report only
 *   npm run seed:purge-glad-tidings -- --confirm  # delete
 *
 * Idempotent; safe to re-run.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import {
  BillProviderConfig,
  BillProviderConfigDocument,
} from '../../bills/schemas/bill-provider-config.schema';
import {
  BillServicePlan,
  BillServicePlanDocument,
} from '../../bills/schemas/bill-service-plan.schema';

async function run() {
  const dryRun = !process.argv.includes('--confirm');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const planModel = app.get<Model<BillServicePlanDocument>>(
      getModelToken(BillServicePlan.name),
      { strict: false },
    );
    const configModel = app.get<Model<BillProviderConfigDocument>>(
      getModelToken(BillProviderConfig.name),
      { strict: false },
    );

    const stalePlans = await planModel.find({ provider: 'gladtidings' }).lean();
    const legacyConfigs = await configModel
      .find({ activeProvider: { $exists: true } })
      .lean();

    console.log(`Found ${stalePlans.length} Gladtidings plan(s).`);
    for (const plan of stalePlans) {
      console.log(
        `  ${dryRun ? 'Would delete' : 'Deleting'} ${plan.serviceType}/${plan.bucket} · ${plan.name} (${plan.externalId})`,
      );
    }

    console.log(
      `Found ${legacyConfigs.length} provider-config document(s) still carrying 'activeProvider'.`,
    );
    for (const config of legacyConfigs) {
      console.log(
        `  ${dryRun ? 'Would unset' : 'Unsetting'} activeProvider on ${config.serviceType}`,
      );
    }

    if (dryRun) {
      console.log('Dry run: nothing was changed. Re-run with --confirm.');
      return;
    }

    if (stalePlans.length > 0) {
      const { deletedCount } = await planModel.deleteMany({
        provider: 'gladtidings',
      });
      console.log(`Deleted ${deletedCount} Gladtidings plan(s).`);
    }

    if (legacyConfigs.length > 0) {
      const { modifiedCount } = await configModel.updateMany(
        { activeProvider: { $exists: true } },
        { $unset: { activeProvider: '' } },
      );
      console.log(
        `Removed 'activeProvider' from ${modifiedCount} provider config(s).`,
      );
    }

    console.log(
      'Done. Sync each category from the Bills console to refresh plans.',
    );
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
