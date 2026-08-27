import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Types, Connection, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { VTPassService, PurchaseResult } from '../payments/vtpass.service';
import {
  GladTidingsService,
  ProviderPlanInput,
} from '../payments/gladtidings.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';
import { UsersService } from '../users/users.service';
import {
  BillProviderConfig,
  BillProviderConfigDocument,
} from './schemas/bill-provider-config.schema';
import {
  BillServicePlan,
  BillServicePlanDocument,
} from './schemas/bill-service-plan.schema';
import {
  BillTransaction,
  BillTransactionDocument,
} from './schemas/bill-transaction.schema';

const BILL_SERVICE_TYPES = ['airtime', 'data', 'cable', 'electricity'] as const;

/** VTPass service IDs for each mobile-friendly network label. */
const DATA_NETWORKS: Record<string, { serviceId: string; bucket: string }> = {
  mtn: { serviceId: 'mtn-data', bucket: 'MTN' },
  airtel: { serviceId: 'airtel-data', bucket: 'AIRTEL' },
  glo: { serviceId: 'glo-data', bucket: 'GLO' },
  '9mobile': { serviceId: 'etisalat-data', bucket: '9MOBILE' },
};

const AIRTIME_NETWORK_SERVICE: Record<string, string> = {
  mtn: 'mtn',
  airtel: 'airtel',
  glo: 'glo',
  '9mobile': 'etisalat',
};

const CABLE_PROVIDERS = ['dstv', 'gotv', 'startimes'];

/** Receipt payload returned after a successful bill purchase and by the
 * `GET /bills/receipts/:reference` / `GET /bills/history` endpoints. */
export interface BillReceipt {
  _id: string;
  user: string;
  type: string;
  status: 'success';
  amount: number;
  reference: string;
  externalReference?: string;
  provider: string;
  recipient: string;
  metadata?: Record<string, unknown>;
  walletTransaction?: string;
}

@Injectable()
export class BillsService implements OnModuleInit {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    private vtpass: VTPassService,
    private gladtidings: GladTidingsService,
    private walletService: WalletService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    @InjectConnection() private connection: Connection,
    @InjectModel(BillProviderConfig.name)
    private providerConfigModel: Model<BillProviderConfigDocument>,
    @InjectModel(BillServicePlan.name)
    private servicePlanModel: Model<BillServicePlanDocument>,
    @InjectModel(BillTransaction.name)
    private billTransactionModel: Model<BillTransactionDocument>,
  ) {}

  /**
   * Startup backfill: gladtidings plans are OFF by default (see `syncPlans`),
   * but any plan that existed before that rule must also be switched off so no
   * gladtidings plan is ever surfaced to the member app until an admin
   * explicitly turns it on.
   */
  async onModuleInit(): Promise<void> {
    try {
      const { modifiedCount } = await this.servicePlanModel.updateMany(
        { provider: 'gladtidings', isActive: true },
        { $set: { isActive: false } },
      );
      if (modifiedCount > 0) {
        this.logger.warn(
          `[BillsService] Startup backfill: switched off ${modifiedCount} gladtidings plan(s)`,
        );
      }
    } catch (e) {
      this.logger.error(
        `[BillsService] Failed to backfill gladtidings plans off: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Returns the platform admin user ID for crediting bill commissions.
   */
  private async getPlatformAdminUserId(): Promise<string> {
    const admin = await this.usersService.findPlatformAdmin();
    return admin._id.toString();
  }

  /**
   * Resolves the active provider for a service category. Defaults to VTPass
   * (the original behaviour) until an admin configures otherwise.
   */
  private async resolveProvider(
    serviceType: string,
  ): Promise<'vtpass' | 'gladtidings'> {
    const cfg = await this.providerConfigModel.findOne({ serviceType }).lean();
    return (cfg?.activeProvider as 'vtpass' | 'gladtidings') ?? 'vtpass';
  }

  /**
   * Builds VTPass catalog entries for the admin sync for a given category.
   */
  private async vtpassCatalog(
    serviceType: string,
  ): Promise<ProviderPlanInput[]> {
    if (serviceType === 'data') {
      const out: ProviderPlanInput[] = [];
      for (const [key, { serviceId, bucket }] of Object.entries(
        DATA_NETWORKS,
      )) {
        try {
          const variations = await this.vtpass.getServiceVariations(serviceId);
          out.push(
            ...variations.map((v) => ({
              externalId: v.variationCode,
              name: v.name,
              amount: v.amount,
              bucket: `${key === '9mobile' ? '9MOBILE' : bucket}`,
              fixedPrice: v.fixedPrice,
            })),
          );
        } catch (e) {
          this.logger.warn(
            `vtpassCatalog data: failed for ${serviceId}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      return out;
    }

    if (serviceType === 'airtime') {
      return Object.entries(AIRTIME_NETWORK_SERVICE).map(
        ([key, serviceId]) => ({
          externalId: serviceId,
          name: key === '9mobile' ? '9MOBILE' : key.toUpperCase(),
          amount: 0,
          bucket: key === '9mobile' ? '9MOBILE' : key.toUpperCase(),
        }),
      );
    }

    if (serviceType === 'cable') {
      const out: ProviderPlanInput[] = [];
      for (const provider of CABLE_PROVIDERS) {
        try {
          const variations = await this.vtpass.getServiceVariations(provider);
          out.push(
            ...variations.map((v) => ({
              externalId: v.variationCode,
              name: v.name,
              amount: v.amount,
              bucket: provider.toUpperCase(),
              fixedPrice: v.fixedPrice,
            })),
          );
        } catch (e) {
          this.logger.warn(
            `vtpassCatalog cable: failed for ${provider}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      return out;
    }

    if (serviceType === 'electricity') {
      return Object.entries(this.DISCO_SERVICE_ID_MAP).map(
        ([key, serviceId]) => ({
          externalId: serviceId,
          name: key.toUpperCase(),
          amount: 0,
          bucket: key.toUpperCase(),
        }),
      );
    }

    return [];
  }

  private readonly DISCO_SERVICE_ID_MAP: Record<string, string> = {
    ikedc: 'ikeja-electric',
    ekedc: 'eko-electric',
    phed: 'portharcourt-electric',
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
    const discoServiceId =
      this.DISCO_SERVICE_ID_MAP[disco.toLowerCase()] ??
      disco.toLowerCase().replace(/\s+/g, '');
    console.log('[BillsService] validateMeter params:', {
      disco,
      discoServiceId,
      meterNumber,
      meterType,
    });
    const result = await this.vtpass.verifyProduct({
      serviceID: discoServiceId,
      billersCode: meterNumber,
    });
    console.log('[BillsService] validateMeter vtpass result:', result);
    if (!result.valid)
      throw new BadRequestException(
        result.message || 'Meter number could not be verified',
      );
    return {
      valid: true,
      customerName: result.name,
      address: result.address,
      packageInfo: result.packageInfo,
      outstanding: result.outstanding,
    };
  }

  async validateSmartCard(serviceProvider: string, smartCardNumber: string) {
    console.log(
      '[BillsService] validateSmartCard raw vtpass response:',
      serviceProvider,
      smartCardNumber,
    );
    const result = await this.vtpass.verifyProduct({
      serviceID: serviceProvider,
      billersCode: smartCardNumber,
    });
    console.log('[BillsService] validateSmartCard processed result:', result);
    if (!result.valid)
      throw new BadRequestException(
        result.message || 'Smart card could not be verified',
      );
    return {
      valid: true,
      customerName: result.name,
      address: result.address,
      packageInfo: result.packageInfo,
      outstanding: result.outstanding,
    };
  }

  private async executeBillTransaction(
    userId: string,
    amount: number,
    provider: string,
    metadata: Record<string, unknown>,
    purchaseFn: () => Promise<PurchaseResult>,
  ): Promise<BillReceipt> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const reference = `bill_${randomUUID()}`;
    const session = await this.connection.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const debitResult = await this.walletService.debitForBillPayment(
          new Types.ObjectId(userId),
          amount,
          reference,
          metadata,
          session,
        );
        if (!debitResult)
          throw new BadRequestException('Insufficient wallet balance');
        try {
          const purchaseResult = await purchaseFn();
          // Confirmed successful external purchase — the user's wallet debit now
          // must stick, so nothing below may throw into the transaction.
          await this.walletService.confirmBillPayment(reference, session);

          // Credit the commission to the platform admin wallet (VTPass returns
          // the exact commission). This must never roll back a successful user
          // purchase, so guard it: if the admin wallet can't be credited (e.g.
          // the platform admin hasn't been seeded), log and continue.
          const commission = purchaseResult.commission;
          if (commission > 0) {
            try {
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
            } catch (commissionError) {
              this.logger.error(
                `Failed to credit bill commission for ${reference}: ${commissionError instanceof Error ? commissionError.message : String(commissionError)}`,
              );
            }
          }

          // Persist the bill transaction so a shareable receipt can be produced
          // for this successful purchase (see `getReceipt` / `getHistory`).
          const externalReference =
            purchaseResult.externalTransactionId || purchaseResult.requestId;

          // Merge any provider-returned details (electricity token/units,
          // customer/package info) into the stored metadata so receipts can
          // render type-specific fields. Kept under `providerDetails` so it
          // never collides with the purchase-time metadata.
          const providerDetails = purchaseResult.providerData ?? {};
          const receiptMetadata = {
            ...metadata,
            ...(Object.keys(providerDetails).length > 0
              ? { providerDetails }
              : {}),
          };

          const [billTx] = await this.billTransactionModel.create(
            [
              {
                user: new Types.ObjectId(userId),
                type: metadata.type as string,
                status: 'success',
                amount,
                reference,
                externalReference,
                provider,
                recipient: (metadata.recipient as string) || '',
                metadata: receiptMetadata,
                walletTransaction: debitResult._id,
              },
            ],
            { session },
          );

          return this.toBillReceipt({
            _id: billTx._id.toString(),
            user: userId,
            type: metadata.type as string,
            status: 'success',
            amount,
            reference,
            externalReference,
            provider,
            recipient: (metadata.recipient as string) || '',
            metadata: receiptMetadata,
            walletTransaction: debitResult._id.toString(),
          });
        } catch (externalError) {
          await this.walletService.failBillPayment(reference, amount, session);
          throw externalError;
        }
      });
      const summary = await this.walletService.getWalletSummary(userId);
      void summary;
      void this.notificationsService.send(
        NotificationEvents.billPaymentSuccess({
          userIds: [userId],
          amount,
          serviceType: metadata.type as string,
          recipient: metadata.recipient as string,
        }),
      );
      return result;
    } finally {
      await session.endSession();
    }
  }

  async purchaseAirtime(
    userId: string,
    dto: { amount: number; phone: string; network: string },
  ) {
    const provider = await this.resolveProvider('airtime');
    if (provider === 'gladtidings') {
      return this.executeBillTransaction(
        userId,
        dto.amount,
        'gladtidings',
        {
          type: 'airtime',
          network: dto.network,
          phone: dto.phone,
          recipient: dto.phone,
        },
        () =>
          this.gladtidings.purchaseAirtime({
            network: dto.network,
            amount: dto.amount,
            phone: dto.phone,
            ported: false,
          }),
      );
    }
    const serviceId = AIRTIME_NETWORK_SERVICE[dto.network] || dto.network;
    return this.executeBillTransaction(
      userId,
      dto.amount,
      'vtpass',
      {
        type: 'airtime',
        network: dto.network,
        phone: dto.phone,
        recipient: dto.phone,
      },
      () =>
        this.vtpass.purchaseAirtime({
          serviceID: serviceId,
          phone: dto.phone,
          amount: dto.amount,
        }),
    );
  }

  async purchaseData(
    userId: string,
    dto: { phone: string; dataPlanId: string; network: string },
  ) {
    const provider = await this.resolveProvider('data');
    if (provider === 'gladtidings') {
      const plan = await this.servicePlanModel
        .findOne({
          serviceType: 'data',
          provider: 'gladtidings',
          externalId: dto.dataPlanId,
          isActive: true,
        })
        .lean();
      if (!plan) throw new BadRequestException('Invalid data plan selected');
      return this.executeBillTransaction(
        userId,
        plan.amount,
        'gladtidings',
        {
          type: 'data',
          variationCode: dto.dataPlanId,
          planName: plan.name,
          network: dto.network,
          phone: dto.phone,
          recipient: dto.phone,
        },
        () =>
          this.gladtidings.purchaseData({
            network: dto.network,
            planId: plan.externalId,
            planAmount: plan.amount,
            phone: dto.phone,
            ported: false,
          }),
      );
    }
    const dataNetwork = DATA_NETWORKS[dto.network];
    const serviceId = dataNetwork?.serviceId || 'mtn-data';
    const variations = await this.vtpass.getServiceVariations(serviceId);
    const variation = variations.find(
      (v) => v.variationCode === dto.dataPlanId,
    );
    if (!variation) throw new BadRequestException('Invalid data plan selected');
    return this.executeBillTransaction(
      userId,
      variation.amount,
      'vtpass',
      {
        type: 'data',
        variationCode: dto.dataPlanId,
        planName: variation.name,
        network: dto.network,
        phone: dto.phone,
        recipient: dto.phone,
      },
      () =>
        this.vtpass.purchaseData({
          serviceID: serviceId,
          phone: dto.phone,
          variationCode: dto.dataPlanId,
        }),
    );
  }

  async purchaseCable(
    userId: string,
    dto: {
      serviceProvider: string;
      smartCardNumber: string;
      amount: number;
      variationCode?: string;
      customerName?: string;
    },
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const provider = await this.resolveProvider('cable');
    if (provider === 'gladtidings') {
      if (!dto.variationCode)
        throw new BadRequestException('A cable plan must be selected');
      const plan = await this.servicePlanModel
        .findOne({
          serviceType: 'cable',
          provider: 'gladtidings',
          externalId: dto.variationCode,
          isActive: true,
        })
        .lean();
      if (!plan) throw new BadRequestException('Invalid cable plan selected');
      return this.executeBillTransaction(
        userId,
        plan.amount,
        'gladtidings',
        {
          type: 'cable',
          serviceProvider: dto.serviceProvider,
          smartCardNumber: dto.smartCardNumber,
          variationCode: dto.variationCode,
          packageName: plan.name,
          ...(dto.customerName ? { customerName: dto.customerName } : {}),
          recipient: dto.smartCardNumber,
        },
        () =>
          this.gladtidings.purchaseCable({
            provider: plan.bucket,
            planId: plan.externalId,
            planAmount: plan.amount,
            smartCardNumber: dto.smartCardNumber,
            phone: user.phone,
          }),
      );
    }
    return this.executeBillTransaction(
      userId,
      dto.amount,
      'vtpass',
      {
        type: 'cable',
        serviceProvider: dto.serviceProvider,
        smartCardNumber: dto.smartCardNumber,
        variationCode: dto.variationCode,
        ...(dto.customerName ? { customerName: dto.customerName } : {}),
        recipient: dto.smartCardNumber,
      },
      () =>
        this.vtpass.purchaseCable({
          serviceID: dto.serviceProvider,
          billersCode: dto.smartCardNumber,
          amount: dto.amount,
          phone: user.phone,
          variationCode: dto.variationCode,
        }),
    );
  }

  async purchaseElectricity(
    userId: string,
    dto: {
      disco: string;
      meterNumber: string;
      meterType: string;
      amount: number;
      phone: string;
      customerName?: string;
    },
  ) {
    const provider = await this.resolveProvider('electricity');
    if (provider === 'gladtidings') {
      return this.executeBillTransaction(
        userId,
        dto.amount,
        'gladtidings',
        {
          type: 'electricity',
          disco: dto.disco,
          meterNumber: dto.meterNumber,
          meterType: dto.meterType,
          ...(dto.customerName ? { customerName: dto.customerName } : {}),
          recipient: dto.meterNumber,
          phone: dto.phone,
        },
        () =>
          this.gladtidings.purchaseElectricity(
            dto.disco,
            dto.meterNumber,
            dto.amount,
            dto.phone,
          ),
      );
    }
    const discoServiceId =
      this.DISCO_SERVICE_ID_MAP[dto.disco.toLowerCase()] ??
      dto.disco.toLowerCase().replace(/\s+/g, '');
    return this.executeBillTransaction(
      userId,
      dto.amount,
      'vtpass',
      {
        type: 'electricity',
        disco: dto.disco,
        meterNumber: dto.meterNumber,
        meterType: dto.meterType,
        ...(dto.customerName ? { customerName: dto.customerName } : {}),
        recipient: dto.meterNumber,
        phone: dto.phone,
      },
      () =>
        this.vtpass.purchaseElectricity({
          serviceID: discoServiceId,
          billersCode: dto.meterNumber,
          amount: dto.amount,
          phone: dto.phone,
          variationCode: dto.meterType,
        }),
    );
  }

  async getDataPlans(network: string) {
    const bucket = network === '9mobile' ? '9MOBILE' : network.toUpperCase();
    const dataNetwork = DATA_NETWORKS[network];
    const provider = await this.resolveProvider('data');
    const bucketFilter = { $regex: `^${bucket}$`, $options: 'i' };

    const synced = await this.servicePlanModel
      .find({
        serviceType: 'data',
        provider,
        bucket: bucketFilter,
        isActive: true,
      })
      .sort({ amount: 1 })
      .lean();
    if (synced.length) {
      return synced.map((p) => ({
        variationCode: p.externalId,
        name: p.name,
        amount: p.amount,
        fixedPrice: p.fixedPrice,
      }));
    }

    // Plans already exist for this provider/network but every one has been
    // toggled OFF in the admin dashboard. Return nothing rather than falling
    // through to a live provider fetch, which would ignore the `isActive`
    // flag and resurrect toggled-off plans.
    const everSynced = await this.servicePlanModel.exists({
      serviceType: 'data',
      provider,
      bucket: bucketFilter,
    });
    if (everSynced) return [];

    // Bootstrapping: this provider/network has never been synced — pull the
    // provider's live catalog as a starting point.
    const serviceId = dataNetwork?.serviceId || 'mtn-data';
    return this.vtpass.getServiceVariations(serviceId);
  }

  async getCablePlans(provider: string) {
    const activeProvider = await this.resolveProvider('cable');
    const synced = await this.servicePlanModel
      .find({
        serviceType: 'cable',
        provider: activeProvider,
        bucket: provider.toUpperCase(),
        isActive: true,
      })
      .sort({ amount: 1 })
      .lean();
    if (synced.length) {
      return synced.map((p) => ({
        variationCode: p.externalId,
        name: p.name,
        amount: p.amount,
        fixedPrice: p.fixedPrice,
      }));
    }

    // Same guard as data: if plans were synced but are all toggled off, do not
    // fall through to a live fetch that would ignore the admin's toggles.
    const everSynced = await this.servicePlanModel.exists({
      serviceType: 'cable',
      provider: activeProvider,
      bucket: provider.toUpperCase(),
    });
    if (everSynced) return [];

    return this.vtpass.getServiceVariations(provider.toLowerCase());
  }

  /**
   * Returns the service categories the member app should surface. Provider
   * selection always has a VTPass fallback (see `resolveProvider`) and per-plan
   * visibility is controlled by each plan's `isActive` toggle — so every
   * category is surfaced to the app: airtime, data, cable and electricity.
   */
  async getActiveServiceTypes(): Promise<string[]> {
    return [...BILL_SERVICE_TYPES];
  }

  // ---- Platform-admin: provider selection + catalog management -------------

  async listProviderConfigs() {
    const configs = await this.providerConfigModel.find({}).lean();
    const counts = await this.servicePlanModel.aggregate<{
      serviceType: string;
      provider: string;
      total: number;
      active: number;
    }>([
      {
        $group: {
          _id: { serviceType: '$serviceType', provider: '$provider' },
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          serviceType: '$_id.serviceType',
          provider: '$_id.provider',
          total: 1,
          active: 1,
        },
      },
    ]);

    return BILL_SERVICE_TYPES.map((serviceType) => {
      const cfg = configs.find((c) => c.serviceType === serviceType);
      const activeProvider = cfg?.activeProvider ?? 'vtpass';
      const stat = counts.find(
        (c) => c.serviceType === serviceType && c.provider === activeProvider,
      );
      return {
        serviceType,
        activeProvider,
        lastSyncedAt: cfg?.lastSyncedAt ?? undefined,
        lastSyncStatus: cfg?.lastSyncStatus ?? 'never',
        planTotal: stat?.total ?? 0,
        planActive: stat?.active ?? 0,
        configured: Boolean(cfg),
      };
    });
  }

  async setProvider(serviceType: string, provider: 'vtpass' | 'gladtidings') {
    await this.providerConfigModel.updateOne(
      { serviceType },
      { $set: { serviceType, activeProvider: provider } },
      { upsert: true },
    );
    return this.listProviderConfigs();
  }

  /**
   * Pulls plans from the category's active provider and upserts them into
   * `BillServicePlan`, preserving existing admin on/off toggles.
   */
  async syncPlans(serviceType: string) {
    const provider = await this.resolveProvider(serviceType);
    const plans: ProviderPlanInput[] =
      provider === 'gladtidings'
        ? await this.gladtidings.getCatalogPlans(serviceType)
        : await this.vtpassCatalog(serviceType);

    let created = 0;
    let updated = 0;
    for (const p of plans) {
      const result = await this.servicePlanModel.updateOne(
        { serviceType, provider, externalId: p.externalId },
        {
          $set: {
            serviceType,
            provider,
            externalId: p.externalId,
            name: p.name,
            bucket: p.bucket,
            amount: p.amount,
            fixedPrice: p.fixedPrice ?? true,
            ...(p.meta ? { meta: p.meta } : {}),
          },
          $setOnInsert: { isActive: provider === 'gladtidings' ? false : true },
        },
        { upsert: true },
      );
      if (result.upsertedCount === 1) created += 1;
      else if (result.matchedCount === 1 && result.modifiedCount === 1)
        updated += 1;
    }

    // Remove plans that no longer exist upstream for this provider/category.
    const remainingIds = plans.map((p) => p.externalId);
    const removed = await this.servicePlanModel.deleteMany({
      serviceType,
      provider,
      externalId: { $nin: remainingIds },
    });

    await this.providerConfigModel.updateOne(
      { serviceType },
      {
        $set: {
          lastSyncedAt: new Date(),
          lastSyncStatus: 'success',
          planCount: plans.length,
        },
      },
      { upsert: true },
    );

    return {
      serviceType,
      provider,
      total: plans.length,
      created,
      updated,
      removed: removed.deletedCount,
    };
  }

  async listPlansAdmin(
    query: {
      serviceType?: string;
      provider?: string;
      bucket?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.serviceType) filter.serviceType = query.serviceType;
    if (query.provider) filter.provider = query.provider;
    if (query.bucket) filter.bucket = query.bucket;

    const [total, plans] = await Promise.all([
      this.servicePlanModel.countDocuments(filter),
      this.servicePlanModel
        .find(filter)
        .sort({ serviceType: 1, bucket: 1, amount: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      plans: plans.map((p) => ({
        id: p._id.toString(),
        serviceType: p.serviceType,
        provider: p.provider,
        externalId: p.externalId,
        name: p.name,
        bucket: p.bucket,
        amount: p.amount,
        fixedPrice: p.fixedPrice,
        isActive: p.isActive,
        updatedAt: (p as unknown as { updatedAt?: Date }).updatedAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async setPlanActive(id: string, isActive: boolean) {
    const plan = await this.servicePlanModel.findById(id);
    if (!plan) throw new NotFoundException('Plan not found');
    plan.isActive = isActive;
    await plan.save();
    return {
      id: plan._id.toString(),
      serviceType: plan.serviceType,
      name: plan.name,
      isActive: plan.isActive,
    };
  }

  /** Maps a stored BillTransaction document to the public receipt shape. */
  private toBillReceipt(raw: {
    _id: string;
    user: string;
    type: string;
    status: 'success';
    amount: number;
    reference: string;
    externalReference?: string;
    provider: string;
    recipient: string;
    metadata?: Record<string, unknown>;
    walletTransaction?: string;
  }): BillReceipt {
    return {
      _id: raw._id,
      user: raw.user.toString(),
      type: raw.type,
      status: 'success',
      amount: raw.amount,
      reference: raw.reference,
      externalReference: raw.externalReference,
      provider: raw.provider,
      recipient: raw.recipient,
      metadata: raw.metadata,
      walletTransaction: raw.walletTransaction?.toString(),
    };
  }

  /** Returns the signing user's bill receipts, newest first. */
  async getHistory(userId: string): Promise<BillReceipt[]> {
    const txns = await this.billTransactionModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return txns.map((t) =>
      this.toBillReceipt({
        _id: t._id.toString(),
        user: t.user.toString(),
        type: t.type,
        status: 'success',
        amount: t.amount,
        reference: t.reference,
        externalReference: t.externalReference,
        provider: t.provider,
        recipient: t.recipient,
        metadata: t.metadata,
        walletTransaction: t.walletTransaction
          ? t.walletTransaction.toString()
          : undefined,
      }),
    );
  }

  /**
   * Returns a single receipt owned by the given user. The reference is the
   * internal `bill_<uuid>` reference assigned at purchase time.
   */
  async getReceipt(userId: string, reference: string): Promise<BillReceipt> {
    const txn = await this.billTransactionModel
      .findOne({ user: userId, reference })
      .lean();
    if (!txn) throw new NotFoundException('Receipt not found');
    return this.toBillReceipt({
      _id: txn._id.toString(),
      user: txn.user.toString(),
      type: txn.type,
      status: 'success',
      amount: txn.amount,
      reference: txn.reference,
      externalReference: txn.externalReference,
      provider: txn.provider,
      recipient: txn.recipient,
      metadata: txn.metadata,
      walletTransaction: txn.walletTransaction
        ? txn.walletTransaction.toString()
        : undefined,
    });
  }

  // ---- Platform-admin: platform-wide bill transactions & receipts -----------

  /**
   * Maps a stored BillTransaction document to the platform-admin ledger /
   * receipt shape, enriched with the owning user's identity.
   */
  private toAdminBillTransaction(
    raw: {
      _id: Types.ObjectId;
      user: { toString(): string };
      type: string;
      status: string;
      amount: number;
      reference: string;
      externalReference?: string;
      provider: string;
      recipient: string;
      metadata?: Record<string, unknown>;
      walletTransaction?: { toString(): string };
      createdAt?: Date;
      updatedAt?: Date;
    },
    user?: { _id: Types.ObjectId; name?: string; phone?: string },
  ) {
    const id = raw._id.toString();
    return {
      id,
      user: {
        id: raw.user.toString(),
        name: user?.name,
        phone: user?.phone ?? '—',
      },
      type: raw.type,
      status: raw.status,
      amount: raw.amount,
      reference: raw.reference,
      externalReference: raw.externalReference,
      provider: raw.provider,
      recipient: raw.recipient,
      metadata: raw.metadata,
      walletTransaction: raw.walletTransaction?.toString(),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  /**
   * Platform-admin view of every bill transaction on the platform (all
   * users), newest first. Filter by service category, status, or user.
   */
  async listTransactionsAdmin(
    query: {
      serviceType?: string;
      status?: string;
      userId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.serviceType) filter.type = query.serviceType;
    if (query.status) filter.status = query.status;
    if (query.userId) filter.user = new Types.ObjectId(query.userId);

    const [total, transactions] = await Promise.all([
      this.billTransactionModel.countDocuments(filter),
      this.billTransactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const userIds = [...new Set(transactions.map((t) => t.user.toString()))];
    const users = await this.usersService.findByIds(userIds);
    const userById = new Map<
      string,
      { _id: Types.ObjectId; name?: string; phone: string }
    >(users.map((u) => [u._id.toString(), u]));

    return {
      transactions: transactions.map((t) =>
        this.toAdminBillTransaction(
          t as Parameters<typeof this.toAdminBillTransaction>[0],
          userById.get(t.user.toString()),
        ),
      ),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Platform-admin receipt lookup for any bill transaction by its record id.
   * Unlike the member-facing `getReceipt` (scoped to `{ user, reference }`),
   * this returns the enriched shape including the customer's identity.
   */
  async getReceiptAdmin(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Receipt not found');
    }
    const txn = await this.billTransactionModel.findById(id).lean();
    if (!txn) throw new NotFoundException('Receipt not found');

    const [owner] = await this.usersService.findByIds([txn.user.toString()]);

    return this.toAdminBillTransaction(
      txn,
      owner
        ? { _id: owner._id, name: owner.name, phone: owner.phone }
        : undefined,
    );
  }
}
