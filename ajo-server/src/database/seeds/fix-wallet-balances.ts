/**
 * One-off script to fix existing wallets with missing/null balances.
 * Run with:
 *
 *   npm run seed:fix-wallet-balances
 *
 * This updates all wallets where balance is missing or null to have balance: 0.
 */
import { NestFactory } from '@nestjs/core';
import { InjectConnection } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import { Connection } from 'mongoose';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const connection = app.get(InjectConnection);

    if (!connection.db) {
      console.error('Database connection not available');
      process.exitCode = 1;
      return;
    }

    console.log('Starting wallet balance migration...');

    const result = await connection.db
      .collection('wallets')
      .updateMany(
        { $or: [{ balance: { $exists: false } }, { balance: null }] },
        { $set: { balance: 0 } },
      );

    console.log(`Migration complete. Updated ${result.modifiedCount} wallets.`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
