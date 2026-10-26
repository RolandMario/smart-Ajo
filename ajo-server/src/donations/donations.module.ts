import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DonationGroup,
  DonationGroupSchema,
} from './schemas/donation-group.schema';
import {
  DonationMember,
  DonationMemberSchema,
} from './schemas/donation-member.schema';
import { Donation, DonationSchema } from './schemas/donation.schema';
import {
  DonationPayout,
  DonationPayoutSchema,
} from './schemas/donation-payout.schema';
import {
  DonationEscrowTransaction,
  DonationEscrowTransactionSchema,
} from './schemas/donation-escrow-transaction.schema';
import { DonationsService } from './donations.service';
import { DonationsController } from './donations.controller';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DonationGroup.name, schema: DonationGroupSchema },
      { name: DonationMember.name, schema: DonationMemberSchema },
      { name: Donation.name, schema: DonationSchema },
      { name: DonationPayout.name, schema: DonationPayoutSchema },
      {
        name: DonationEscrowTransaction.name,
        schema: DonationEscrowTransactionSchema,
      },
    ]),
    WalletModule,
    PaymentsModule,
    UsersModule,
    forwardRef(() => NotificationsModule),
    PlatformSettingsModule,
  ],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService, MongooseModule],
})
export class DonationsModule {}
