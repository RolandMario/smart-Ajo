/**
 * One-off script to finish the cleanup older API versions left behind.
 *
 * Terminating a pool now deletes the pool and everything scoped to it
 * (`DonationsService.terminateGroup` → `DonationsService.purgeGroup`). Pools
 * terminated before that change are still in the database with
 * `status: 'terminated'`, invisible to the app (`GET /donations/groups`
 * filters them out) but still holding donations, memberships, payouts and
 * escrow movements.
 *
 * This script purges them exactly the way live termination does — same
 * cascade, same transaction, via `DonationsService.purgeGroup`.
 *
 * A legacy pool whose escrow still holds money is skipped and reported: that
 * balance belongs to the members and has to be paid out first, the same rule
 * live termination enforces. Re-run the script after handling it.
 *
 * Dry run by default — pass `--confirm` to actually delete:
 *
 *   npm run seed:purge-terminated-pools               # report only
 *   npm run seed:purge-terminated-pools -- --confirm  # delete
 *
 * Idempotent; safe to re-run.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DonationsService } from '../../donations/donations.service';

async function run() {
  const dryRun = !process.argv.includes('--confirm');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const donationsService = app.get(DonationsService);
    const result = await donationsService.purgeTerminatedPools({ dryRun });

    console.log(`Found ${result.scanned} pool(s) still marked 'terminated'.`);

    for (const pool of result.purged) {
      console.log(
        `${dryRun ? 'Would purge' : 'Purged'} ${pool.id} (${pool.name})`,
      );
    }

    for (const pool of result.skipped) {
      console.log(
        `Skipped ${pool.id} (${pool.name}) — escrow still holds ` +
          `₦${pool.balance.toLocaleString()}. Pay it out, then re-run.`,
      );
    }

    if (dryRun) {
      console.log(
        `Dry run: ${result.purged.length} pool(s) would be purged, ` +
          `${result.skipped.length} skipped. ` +
          'Re-run with --confirm to delete.',
      );
    } else {
      console.log(
        `Purged ${result.purged.length} pool(s); ` +
          `${result.skipped.length} skipped.`,
      );
    }
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
