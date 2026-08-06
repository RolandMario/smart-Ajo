/**
 * One-off script to create the very first platform_admin account so
 * someone can log in to ajo-admin-web. Run with:
 *
 *   npm run seed:platform-admin
 *
 * Requires SEED_PLATFORM_ADMIN_EMAIL, SEED_PLATFORM_ADMIN_PASSWORD and
 * SEED_PLATFORM_ADMIN_PHONE to be set in .env.
 *
 * Once this account exists, it can be used to create additional
 * platform_admin accounts through the admin web dashboard (a future
 * "manage admins" screen) — this script should not need to be run again
 * except for disaster recovery.
 */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../app.module';
import { UsersService } from '../../users/users.service';

const SALT_ROUNDS = 10;

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const configService = app.get(ConfigService);
    const usersService = app.get(UsersService);

    const email = configService.get<string>('SEED_PLATFORM_ADMIN_EMAIL');
    const password = configService.get<string>('SEED_PLATFORM_ADMIN_PASSWORD');
    const phone = configService.get<string>('SEED_PLATFORM_ADMIN_PHONE');

    if (!email || !password || !phone) {
      console.error(
        'SEED_PLATFORM_ADMIN_EMAIL, SEED_PLATFORM_ADMIN_PASSWORD and SEED_PLATFORM_ADMIN_PHONE must be set in .env',
      );
      process.exitCode = 1;
      return;
    }

    const existing = await usersService.findByEmail(email);
    if (existing) {
      console.log(
        `A user with email ${email} already exists (id: ${existing._id.toString()}). Nothing to do.`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const admin = await usersService.createPlatformAdmin({
      email,
      phone,
      passwordHash,
      name: 'Platform Admin',
    });

    console.log(
      `Created platform_admin: ${admin.email} (id: ${admin._id.toString()})`,
    );
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
