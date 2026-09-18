/**
 * One-off migration for the 'group rounds' feature.
 *
 * Cycles are now uniquely identified by (group, round, cycleNumber),
 * so a continued group can restart cycle numbers at 1 without colliding.
 * Backfills round=1 on existing cycles and currentRound=1 on groups, then
 * swaps the legacy unique index group_1_cycleNumber_1 for the new
 * group_1_round_1_cycleNumber_1. Idempotent; safe to re-run.
 *
 * Run with: npm run seed:backfill-cycle-rounds
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { Cycle, CycleDocument } from '../../cycles/schemas/cycle.schema';
import { Group, GroupDocument } from '../../groups/schemas/group.schema';

const OLD_INDEX_NAME = 'group_1_cycleNumber_1';
const NEW_INDEX_NAME = 'group_1_round_1_cycleNumber_1';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const cycleModel = app.get<Model<CycleDocument>>(getModelToken(Cycle.name));
    const groupModel = app.get<Model<GroupDocument>>(getModelToken(Group.name));
    // 1. Backfill round=1 on cycles created before the field existed.
    const cycleBackfill = await cycleModel.updateMany(
      { round: { $exists: false } },
      { $set: { round: 1 } },
    );
    console.log(
      `Backfilled round=1 on ${cycleBackfill.modifiedCount} cycle(s).`,
    );

    // 2. Backfill currentRound=1 on groups (safety net).
    const groupBackfill = await groupModel.updateMany(
      { currentRound: { $exists: false } },
      { $set: { currentRound: 1 } },
    );
    console.log(
      `Backfilled currentRound=1 on ${groupBackfill.modifiedCount} group(s).`,
    );
    // 3. Swap the legacy (group, cycleNumber) unique index for
    //    (group, round, cycleNumber).
    const existing = await cycleModel.collection.listIndexes().toArray();
    const hasOldIndex = existing.some((i) => i.name === OLD_INDEX_NAME);
    const hasNewIndex = existing.some(
      (i) => i.name === NEW_INDEX_NAME || i.key.round !== undefined,
    );

    if (hasOldIndex && !hasNewIndex) {
      await cycleModel.collection.dropIndex(OLD_INDEX_NAME);
      console.log(`Dropped legacy unique index ${OLD_INDEX_NAME}.`);
    }
    if (!hasNewIndex) {
      await cycleModel.collection.createIndex(
        { group: 1, round: 1, cycleNumber: 1 },
        { unique: true, name: NEW_INDEX_NAME },
      );
      console.log(`Created unique index ${NEW_INDEX_NAME}.`);
    } else {
      console.log(`Index ${NEW_INDEX_NAME} already present; nothing to do.`);
    }
    console.log('Migration complete.');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
