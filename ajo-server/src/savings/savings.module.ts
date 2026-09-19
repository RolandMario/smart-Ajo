import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SavingPlan, SavingPlanSchema } from './schemas/saving-plan.schema';
import {
  SavingTransaction,
  SavingTransactionSchema,
} from './schemas/saving-transaction.schema';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { SavingsCronController } from './savings.cron.controller';
import { SavingsScheduler } from './savings.scheduler';
import { CronAuthGuard } from '../common/guards/cron-auth.guard';
import { WalletModule } from '../wallet/wallet.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SavingPlan.name, schema: SavingPlanSchema },
      { name: SavingTransaction.name, schema: SavingTransactionSchema },
    ]),
    WalletModule,
    PaymentsModule,
    UsersModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [SavingsController, SavingsCronController],
  providers: [SavingsService, SavingsScheduler, CronAuthGuard],
  exports: [SavingsService, MongooseModule],
})
export class SavingsModule {}
