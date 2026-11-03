/**
 * Provisions (or re-prints) a member's own Dedicated Virtual Account.
 *
 *   npm run seed:provision-dedicated-account -- +2347068497568
 *
 * Runs the real `WalletService.getOrCreateDedicatedAccount` path, so it uses
 * whatever Paystack key is configured — `sk_live_…` mints a LIVE account
 * number — and persists the result on the user exactly like the app does
 * (`User.dedicatedAccount`, including the Paystack customer code, email and
 * mode). Safe to re-run: an existing active account is returned unchanged.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { UsersService } from '../../users/users.service';
import { WalletService } from '../../wallet/wallet.service';
import { toE164Nigeria } from '../../common/utils/phone';

async function run() {
  const rawPhone = process.argv[2];

  if (!rawPhone) {
    console.error(
      'Usage: npm run seed:provision-dedicated-account -- <phone, e.g. 07068497568>',
    );
    process.exitCode = 1;
    return;
  }

  const phone = toE164Nigeria(rawPhone) as string;
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const users = app.get(UsersService);
    const wallet = app.get(WalletService);

    const user = await users.findByPhone(phone);

    if (!user) {
      console.error(`No member found for ${phone}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `Provisioning dedicated account for ${phone} (${user.name ?? 'no name set'})…`,
    );

    const account = await wallet.getOrCreateDedicatedAccount(
      user._id.toString(),
    );

    console.log('Dedicated account ready:', {
      bank: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      paystackCustomerCode: account.paystackCustomerCode,
      paystackCustomerEmail: account.paystackCustomerEmail,
      paystackMode: account.paystackMode,
      active: account.active,
    });
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err?.response?.message ?? err);
  process.exit(1);
});
