import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { VTPassService } from '../payments/vtpass.service';
import { GladTidingsService } from '../payments/gladtidings.service';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import {
  BillTransaction,
  BillTransactionSchema,
} from './schemas/bill-transaction.schema';
import {
  BillProviderConfig,
  BillProviderConfigSchema,
} from './schemas/bill-provider-config.schema';
import {
  BillServicePlan,
  BillServicePlanSchema,
} from './schemas/bill-service-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BillTransaction.name, schema: BillTransactionSchema },
      { name: BillProviderConfig.name, schema: BillProviderConfigSchema },
      { name: BillServicePlan.name, schema: BillServicePlanSchema },
    ]),
    WalletModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [BillsController],
  providers: [BillsService, VTPassService, GladTidingsService],
  exports: [BillsService],
})
export class BillsModule {}
