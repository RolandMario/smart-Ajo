import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaymentsModule } from '../payments/payments.module';
import { WalletModule } from '../wallet/wallet.module';
import { CyclesModule } from '../cycles/cycles.module';
import { SavingsModule } from '../savings/savings.module';
import { DonationsModule } from '../donations/donations.module';

@Module({
  imports: [
    PaymentsModule,
    WalletModule,
    CyclesModule,
    SavingsModule,
    DonationsModule,
  ],
  controllers: [WebhookController],
})
export class WebhooksModule {}
