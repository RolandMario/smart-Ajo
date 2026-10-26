/**
 * One-off migration for the 'Group ID' feature.
 *
 * Groups now require a unique, human-friendly `joinCode` — the shareable
 * "Group ID" members type into the Join Group screen. Backfills a code on
 * every group that doesn't already have one. Covers existing groups created
 * before the field existed. Idempotent; safe to re-run.
 *
 * Run with: npm run seed:backfill-join-codes
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../app.module';
import { Group, GroupDocument } from '../../groups/schemas/group.schema';
import { generateJoinCode } from '../../groups/join-code';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const groupModel = app.get<Model<GroupDocument>>(getModelToken(Group.name));

    const groupsWithoutCode = await groupModel.find({
      $or: [{ joinCode: { $exists: false } }, { joinCode: null }],
    });

    let assigned = 0;
    for (const group of groupsWithoutCode) {
      // The code is unique across groups. Retry a few fresh codes per group
      // in the (astronomically unlikely) event of a collision.
      for (let attempt = 0; attempt < 10; attempt++) {
        group.joinCode = generateJoinCode();
        try {
          await group.save();
          assigned++;
          break;
        } catch (err) {
          const isDuplicate =
            typeof err === 'object' &&
            err !== null &&
            (err as { code?: number }).code === 11000;
          if (!isDuplicate) throw err;
          // collision with an existing code — try again
        }
      }
    }

    console.log(
      `Backfilled joinCode on ${assigned}/${groupsWithoutCode.length} group(s).`,
    );
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
