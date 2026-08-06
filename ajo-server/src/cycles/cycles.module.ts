import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cycle, CycleSchema } from './schemas/cycle.schema';
import {
  Contribution,
  ContributionSchema,
} from './schemas/contribution.schema';
import { GroupWallet, GroupWalletSchema } from './schemas/group-wallet.schema';
import {
  GroupWalletTransaction,
  GroupWalletTransactionSchema,
} from './schemas/group-wallet-transaction.schema';
import { Payout, PayoutSchema } from './schemas/payout.schema';
import { CyclesService } from './cycles.service';
import { CyclesController } from './cycles.controller';
import { GroupsModule } from '../groups/groups.module';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cycle.name, schema: CycleSchema },
      { name: Contribution.name, schema: ContributionSchema },
      { name: GroupWallet.name, schema: GroupWalletSchema },
      {
        name: GroupWalletTransaction.name,
        schema: GroupWalletTransactionSchema,
      },
      { name: Payout.name, schema: PayoutSchema },
    ]),
    forwardRef(() => GroupsModule),
    WalletModule,
    PaymentsModule,
    UsersModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [CyclesController],
  providers: [CyclesService],
  exports: [CyclesService, MongooseModule],
})
export class CyclesModule {}
