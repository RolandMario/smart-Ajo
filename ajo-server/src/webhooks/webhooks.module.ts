import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaymentsModule } from '../payments/payments.module';
import { WalletModule } from '../wallet/wallet.module';
import { CyclesModule } from '../cycles/cycles.module';

@Module({
  imports: [PaymentsModule, WalletModule, CyclesModule],
  controllers: [WebhookController],
})
export class WebhooksModule {}
