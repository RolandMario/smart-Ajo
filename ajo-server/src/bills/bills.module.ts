import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { VTPassService } from '../payments/vtpass.service';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { BillTransaction, BillTransactionSchema } from './schemas/bill-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BillTransaction.name, schema: BillTransactionSchema }]),
    WalletModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [BillsController],
  providers: [BillsService, VTPassService],
  exports: [BillsService],
})
export class BillsModule {}
