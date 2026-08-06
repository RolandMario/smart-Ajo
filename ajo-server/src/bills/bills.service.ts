import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, Connection } from 'mongoose';
import { randomUUID } from 'crypto';
import { VTPassService } from '../payments/vtpass.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';
import { UsersService } from '../users/users.service';

@Injectable()
export class BillsService {
  constructor(
    private vtpass: VTPassService,
    private walletService: WalletService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    @InjectConnection() private connection: Connection,
  ) {}

  /**
   * Returns the platform admin user ID for crediting bill commissions.
   */
  private async getPlatformAdminUserId(): Promise<string> {
    const admin = await this.usersService.findPlatformAdmin();
    return admin._id.toString();
  }

  private readonly DISCO_SERVICE_ID_MAP: Record<string, string> = {
    ikedc: 'ikeja-electric',
    ekedc: 'eko-electric',
    phed: 'phedc',
    jed: 'jos-electric',
    aedc: 'abuja-electric',
    kaedco: 'kano-electric',
    ibedc: 'ibadan-electric',
    eedc: 'enugu-electric',
    bedc: 'benin-electric',
    kedco: 'kaduna-electric',
    aba: 'aba-electric',
    yedc: 'yola-electric',
  };

  async validateMeter(disco: string, meterNumber: string, meterType: string) {
    const discoServiceId = this.DISCO_SERVICE_ID_MAP[disco.toLowerCase()] ?? disco.toLowerCase().replace(/\s+/g, '');
    console.log('[BillsService] validateMeter params:', { disco, discoServiceId, meterNumber, meterType });
    const result = await this.vtpass.verifyProduct({
      serviceID: discoServiceId, billersCode: meterNumber,
    });
    console.log('[BillsService] validateMeter vtpass result:', result);
    if (!result.valid) throw new BadRequestException(result.message || 'Meter number could not be verified');
    return { valid: true, customerName: result.name, address: result.address, packageInfo: result.packageInfo, outstanding: result.outstanding };
  }

  async validateSmartCard(serviceProvider: string, smartCardNumber: string) {
    console.log('[BillsService] validateSmartCard raw vtpass response:', serviceProvider, smartCardNumber);
    const result = await this.vtpass.verifyProduct({
      serviceID: serviceProvider, billersCode: smartCardNumber,
    });
    console.log('[BillsService] validateSmartCard processed result:', result);
    if (!result.valid) throw new BadRequestException(result.message || 'Smart card could not be verified');
    return { valid: true, customerName: result.name, address: result.address, packageInfo: result.packageInfo, outstanding: result.outstanding };
  }

  private async executeBillTransaction(
    userId: string, amount: number, metadata: Record<string, unknown>, purchaseFn: () => Promise<{ commission: number }>,
  ): Promise<{ commission: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const reference = `bill_${randomUUID()}`;
    const session = await this.connection.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const debitResult = await this.walletService.debitForBillPayment(
          new Types.ObjectId(userId), amount, reference, metadata, session,
        );
        if (!debitResult) throw new BadRequestException('Insufficient wallet balance');
        try {
          const purchaseResult = await purchaseFn();
          // Confirm the bill payment
          await this.walletService.confirmBillPayment(reference);
          // Credit the commission to admin wallet (VTPass returns the exact commission)
          const commission = purchaseResult.commission;
          if (commission > 0) {
            const adminUserId = await this.getPlatformAdminUserId();
            await this.walletService.creditBillCommission(
              adminUserId,
              commission,
              {
                billReference: reference,
                billType: (metadata.type as string) || 'unknown',
                userPaid: amount,
                actualCost: amount - commission,
              },
              session,
            );
          }
          return purchaseResult;
        } catch (externalError) {
          await this.walletService.failBillPayment(reference, amount, session);
          throw externalError;
        }
      });
      const summary = await this.walletService.getWalletSummary(userId);
      void this.notificationsService.send(
        NotificationEvents.billPaymentSuccess({ userIds: [userId], amount, serviceType: metadata.type as string, recipient: metadata.recipient as string }),
      );
      return result;
    } finally { await session.endSession(); }
  }

  async purchaseAirtime(userId: string, dto: { amount: number; phone: string; network: string }) {
    const serviceMap: Record<string, string> = { mtn: 'mtn', glo: 'glo', airtel: 'airtel', '9mobile': 'etisalat' };
    const serviceId = serviceMap[dto.network] || dto.network;
    return this.executeBillTransaction(userId, dto.amount, { type: 'airtime', network: dto.network, phone: dto.phone, recipient: dto.phone }, () =>
      this.vtpass.purchaseAirtime({ serviceID: serviceId, phone: dto.phone, amount: dto.amount })
    );
  }

  async purchaseData(userId: string, dto: { phone: string; dataPlanId: string; network: string }) {
    const serviceMap: Record<string, string> = { mtn: 'mtn-data', airtel: 'airtel-data', glo: 'glo-data', '9mobile': 'etisalat-data' };
    const serviceId = serviceMap[dto.network] || dto.network;
    const variations = await this.vtpass.getServiceVariations(serviceId);
    const variation = variations.find((v) => v.variationCode === dto.dataPlanId);
    if (!variation) throw new BadRequestException('Invalid data plan selected');
    return this.executeBillTransaction(userId, variation.amount, { type: 'data', variationCode: dto.dataPlanId, network: dto.network, phone: dto.phone, recipient: dto.phone }, () =>
      this.vtpass.purchaseData({ serviceID: serviceId, phone: dto.phone, variationCode: dto.dataPlanId })
    );
  }

  async purchaseCable(userId: string, dto: { serviceProvider: string; smartCardNumber: string; amount: number }) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.executeBillTransaction(userId, dto.amount, { type: 'cable', serviceProvider: dto.serviceProvider, smartCardNumber: dto.smartCardNumber, recipient: dto.smartCardNumber }, () =>
      this.vtpass.purchaseCable({ serviceID: dto.serviceProvider, billersCode: dto.smartCardNumber, amount: dto.amount, phone: user.phone })
    );
  }

  async purchaseElectricity(userId: string, dto: { disco: string; meterNumber: string; meterType: string; amount: number; phone: string }) {
    const discoServiceId = this.DISCO_SERVICE_ID_MAP[dto.disco.toLowerCase()] ?? dto.disco.toLowerCase().replace(/\s+/g, '');
    return this.executeBillTransaction(userId, dto.amount, { type: 'electricity', disco: dto.disco, meterNumber: dto.meterNumber, meterType: dto.meterType, recipient: dto.meterNumber, phone: dto.phone }, () =>
      this.vtpass.purchaseElectricity({ serviceID: discoServiceId, billerCode: dto.meterNumber, amount: dto.amount, phone: dto.phone })
    );
  }

  async getDataPlans(network: string) {
    const serviceMap: Record<string, string> = { mtn: 'mtn-data', airtel: 'airtel-data', glo: 'glo-data', '9mobile': 'etisalat-data' };
    const serviceId = serviceMap[network] || 'mtn-data';
    return this.vtpass.getServiceVariations(serviceId);
  }

  async getCablePlans(provider: string) {
    return this.vtpass.getServiceVariations(provider.toLowerCase());
  }

  async getHistory(userId: string) {
    // TODO: wire up BillTransaction model lookup once schema is imported
    return [];
  }
}
