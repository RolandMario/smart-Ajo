/**
 * One-off script to finish the cleanup older API versions left behind.
 *
 * Terminating a group now deletes the group and everything scoped to it
 * (`GroupsService.terminateGroup`). Groups terminated before that change are
 * still in the database with `status: 'terminated'`, invisible to the app
 * (`listMyGroups`, Group-ID search, invites and the admin screens all filter
 * them out) but still holding memberships, cycles, contributions, group
 * wallet ledgers, escrow deposits and payouts.
 *
 * This script purges them exactly the way live termination does — same
 * cascade, same transaction, via `GroupsService.purgeGroup`.
 *
 * A legacy group whose central account still holds money is skipped and
 * reported: that balance belongs to the members and has to be paid out first,
 * the same rule live termination enforces. Re-run the script after handling it.
 *
 * Dry run by default — pass `--confirm` to actually delete:
 *
 *   npm run seed:purge-terminated-groups               # report only
 *   npm run seed:purge-terminated-groups -- --confirm  # delete
 *
 * Idempotent; safe to re-run.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { GroupsService } from '../../groups/groups.service';

async function run() {
  const dryRun = !process.argv.includes('--confirm');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const groupsService = app.get(GroupsService);
    const result = await groupsService.purgeTerminatedGroups({ dryRun });

    console.log(`Found ${result.scanned} group(s) still marked 'terminated'.`);

    for (const group of result.purged) {
      console.log(
        `  ${dryRun ? 'Would purge' : 'Purged'} ${group.id} (${group.name})`,
      );
    }

    for (const group of result.skipped) {
      console.log(
        `  Skipped ${group.id} (${group.name}) — group account still holds ` +
          `₦${group.balance.toLocaleString()}. Pay it out, then re-run.`,
      );
    }

    if (dryRun) {
      console.log(
        `Dry run: ${result.purged.length} group(s) would be purged, ` +
          `${result.skipped.length} skipped. ` +
          'Re-run with --confirm to delete.',
      );
    } else {
      console.log(
        `Purged ${result.purged.length} group(s); ` +
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
