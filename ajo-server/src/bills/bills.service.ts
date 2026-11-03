import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Types, Connection, Model } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  VTPassService,
  PurchaseResult,
  ServiceVariation,
  VerifyProductResult,
} from '../payments/vtpass.service';
import { WalletService } from '../wallet/wallet.service';
import type { BillPaymentSource } from '../wallet/wallet.service';
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

/** VTpass cable serviceIDs, keyed by the provider label the app sends. */
const CABLE_PROVIDER_SERVICE_IDS: Record<string, string> = {
  dstv: 'dstv',
  gotv: 'gotv',
  startimes: 'startimes',
};

const CABLE_PROVIDERS = Object.keys(CABLE_PROVIDER_SERVICE_IDS);

/**
 * VTpass puts the price inside most bouquet names ("DStv Compact N19,000",
 * "GOtv Smallie - monthly N1,900", "Nova - 900 Naira - 1 Month"). The app and
 * the receipt show the amount on its own line, so serving the vendor's price
 * suffix twice reads as a double charge — it is stripped here instead.
 */

/** A name segment that is nothing but a price: `N3,500`, `₦2,500`, `700 Naira`. */
const PRICE_ONLY_SEGMENT =
  /^(?:₦|NGN|N)?\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:naira|ngn)?$/i;
/** A price trailing a name, with or without a dash or currency prefix. */
const TRAILING_PRICE =
  /(?:\s+[-–—]\s+|\s+)\(?(?:₦|NGN|N)?\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:naira|ngn)?\)?$/i;

/**
 * Removes VTpass' price suffix from a plan name.
 *
 * Dashed names are split first so a price sitting in the middle
 * ("Nova - 900 Naira - 1 Month") goes away without eating the duration, then a
 * trailing price ("DStv Compact N19,000") is trimmed. The original name is kept
 * if stripping would leave nothing.
 */
function stripPlanPrice(rawName: string): string {
  const kept = rawName
    .split(/\s+[-–—]\s+/)
    .filter((segment) => !PRICE_ONLY_SEGMENT.test(segment.trim()));
  const stripped = kept.join(' - ').replace(TRAILING_PRICE, '');
  return (stripped.trim() || rawName).replace(/\s+/g, ' ').trim();
}

/** Lowercased words only, so "DStv  Compact N19,000" → "dstv compact". */
function bouquetKey(name?: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * How long a live VTpass catalogue (data plans, cable bouquets) is reused
 * before the vendor is asked again. Short enough that new plans and price
 * changes surface within minutes, long enough that flipping between networks
 * in the app is not a VTpass round-trip every single time.
 */
const CATALOGUE_CACHE_TTL_MS = 5 * 60_000;

/**
 * A live VTpass catalogue plus the admin's cashback rate for each plan code.
 *
 * Only the vendor's plan list is cached; `cashback` (and the hidden-plan set
 * behind it) is re-read from `BillServicePlan` on every call so a rate saved in
 * the admin console takes effect on the member's very next request instead of
 * after the catalogue cache expires.
 */
interface LiveCatalogue {
  plans: ServiceVariation[];
  /** `variationCode` → cashback percent (0 when the plan earns nothing). */
  cashback: Map<string, number>;
}

/**
 * Cashback in naira for a purchase — a percentage of the amount, rounded to
 * 2 dp (₦100 at 0.5% = ₦0.5). A missing or out-of-range rate earns nothing.
 */
function cashbackFor(amount: number, percent?: number): number {
  const rate =
    typeof percent === 'number' && Number.isFinite(percent)
      ? Math.min(Math.max(percent, 0), 100)
      : 0;
  if (rate <= 0 || amount <= 0) return 0;
  return Math.round(((amount * rate) / 100) * 100) / 100;
}

/** Clamps a stored cashback rate into 0–100, defaulting to 0. */
function clampCashbackPercent(percent?: number | null): number {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 0;
  return Math.min(Math.max(percent, 0), 100);
}

/** VTpass electricity vending limits, in naira. */
const ELECTRICITY_MIN_AMOUNT = 500;
const ELECTRICITY_MAX_AMOUNT = 500_000;

/** A single plan pulled from the VTpass catalogue during an admin sync. */
interface CatalogPlan {
  externalId: string;
  name: string;
  amount: number;
  bucket: string;
  fixedPrice?: boolean;
  meta?: Record<string, unknown>;
}

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
  /** Set by the schema's `timestamps: true`; included so clients can show
   * "2d ago"-style relative times on receipts and history rows. */
  createdAt?: string;
}

/** The only bills provider. Kept as a constant so stored plans stay tagged. */
const BILLS_PROVIDER = 'vtpass';

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  /** Live VTpass catalogues keyed by `<serviceType>:<label>`
   * (`data:mtn`, `cable:dstv`, …). Only the vendor's plan list is cached — the
   * admin's overlays are read fresh on every call (see `planOverlay`). */
  private readonly catalogueCache = new Map<
    string,
    { fetchedAt: number; plans: ServiceVariation[] }
  >();

  constructor(
    private vtpass: VTPassService,
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
   * Bills need a working VTpass key pair. When it is missing the member app
   * gets an actionable 503 naming the variables instead of VTpass' opaque
   * "087 INVALID CREDENTIALS" (or a silently refunded purchase).
   */
  private assertBillsConfigured(): void {
    if (this.vtpass.isConfigured()) return;
    throw new ServiceUnavailableException(
      `Bill payments are not configured on this server: ${this.vtpass.missingConfig().join(', ')} missing. Add the VTpass key pair to ajo-server/.env and restart the server.`,
    );
  }

  /**
   * Returns the platform admin user ID for crediting bill commissions.
   */
  private async getPlatformAdminUserId(): Promise<string> {
    const admin = await this.usersService.findPlatformAdmin();
    return admin._id.toString();
  }

  /**
   * Cashback rate the admin configured for one plan row.
   *
   * Categories without a live plan catalogue of their own (airtime networks,
   * electricity discos) and cable renewals — where only the plan code is known
   * — read their rate straight from `BillServicePlan`.
   */
  private async planCashbackPercent(
    serviceType: 'airtime' | 'data' | 'cable' | 'electricity',
    externalId: string,
  ): Promise<number> {
    if (!externalId) return 0;
    const row = await this.servicePlanModel
      .findOne({ serviceType, provider: BILLS_PROVIDER, externalId })
      .lean();
    return clampCashbackPercent(row?.cashbackPercent);
  }

  /**
   * Builds VTPass catalog entries for the admin sync for a given category.
   */
  private async vtpassCatalog(serviceType: string): Promise<CatalogPlan[]> {
    if (serviceType === 'data') {
      const out: CatalogPlan[] = [];
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
      const out: CatalogPlan[] = [];
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

  /**
   * Resolves the price to charge for a cable bouquet from the live catalogue.
   *
   * Replaced `resolvePlanPrice`, which trusted the synced `BillServicePlan`
   * row. Those rows only refresh on an admin sync, so a member could be shown
   * a live bouquet and charged a stale price (or a removed bouquet stayed
   * sellable). The live catalogue is now authoritative for name and amount;
   * the stored row is consulted only for the admin's on/off toggle, so a
   * bouquet switched OFF in the console answers "currently unavailable"
   * instead of quietly vending.
   */
  private async resolveLiveCablePlan(
    provider: string,
    variationCode: string,
  ): Promise<{ name: string; amount: number; cashbackPercent: number }> {
    const { key, bucket } = this.cableProviderEntry(provider);

    const { plans: live, cashback } = await this.liveCablePlans(key);
    const match = live.find((v) => v.variationCode === variationCode);
    if (match)
      return {
        name: stripPlanPrice(match.name),
        amount: match.amount,
        cashbackPercent: cashback.get(match.variationCode) ?? 0,
      };

    const stored = await this.servicePlanModel
      .findOne({
        serviceType: 'cable',
        provider: BILLS_PROVIDER,
        externalId: variationCode,
        bucket: { $regex: `^${bucket}$`, $options: 'i' },
      })
      .lean();
    if (stored && !stored.isActive) {
      throw new BadRequestException(
        `${stripPlanPrice(stored.name)} is currently unavailable`,
      );
    }
    throw new BadRequestException('Invalid cable plan selected');
  }

  async validateMeter(disco: string, meterNumber: string, meterType: string) {
    this.assertBillsConfigured();
    const discoServiceId =
      this.DISCO_SERVICE_ID_MAP[disco.toLowerCase()] ??
      disco.toLowerCase().replace(/\s+/g, '');
    const result = await this.vtpass.verifyProduct({
      serviceID: discoServiceId,
      billersCode: meterNumber,
    });
    if (!result.valid)
      throw new BadRequestException(
        result.message || 'Meter number could not be verified',
      );
    return { meterType, ...this.toValidationResult(result) };
  }

  async validateSmartCard(serviceProvider: string, smartCardNumber: string) {
    this.assertBillsConfigured();
    const result = await this.vtpass.verifyProduct({
      serviceID: serviceProvider,
      billersCode: smartCardNumber,
    });
    if (!result.valid)
      throw new BadRequestException(
        result.message || 'Smart card could not be verified',
      );
    const validation = this.toValidationResult(result);
    // VTpass sometimes reports the current bouquet as the catalogue name,
    // price included ("DStv Compact N19,000"); the app shows the renewal
    // amount separately, so the price is stripped here like in the catalogue.
    return validation.packageInfo
      ? { ...validation, packageInfo: stripPlanPrice(validation.packageInfo) }
      : validation;
  }

  /**
   * Body shared by both validate endpoints. The member app reads the customer
   * name from `name`; `customerName` is returned as well so older builds that
   * read the provider's own field name keep working.
   */
  private toValidationResult(result: VerifyProductResult) {
    return {
      valid: true,
      name: result.name,
      customerName: result.name,
      address: result.address,
      packageInfo: result.packageInfo,
      outstanding: result.outstanding,
    };
  }

  /**
   * Runs one bill purchase: debit the member's chosen wallet, call the
   * provider, and only then commit.
   *
   * `options.paymentSource` picks the balance to debit (main wallet by
   * default, or the cashback wallet). `options.cashbackPercent` is the rate
   * configured on the plan being sold; when it is above zero the earned
   * cashback is credited to the cashback wallet inside the same transaction,
   * *after* the vend succeeded — a failed purchase never earns anything.
   */
  private async executeBillTransaction(
    userId: string,
    amount: number,
    provider: string,
    metadata: Record<string, unknown>,
    purchaseFn: () => Promise<PurchaseResult>,
    options: {
      paymentSource?: BillPaymentSource;
      cashbackPercent?: number;
    } = {},
  ): Promise<BillReceipt> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const paymentSource: BillPaymentSource =
      options.paymentSource === 'cashback' ? 'cashback' : 'main';
    const cashbackPercent = clampCashbackPercent(options.cashbackPercent);
    const cashbackEarned = cashbackFor(amount, cashbackPercent);
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
          { source: paymentSource },
        );
        if (!debitResult)
          throw new BadRequestException(
            paymentSource === 'cashback'
              ? 'Insufficient cashback balance'
              : 'Insufficient wallet balance',
          );
        try {
          const purchaseResult = await purchaseFn();
          // Confirmed successful external purchase — the user's wallet debit now
          // must stick, so nothing below may throw into the transaction.
          await this.walletService.confirmBillPayment(reference, session);

          // Cashback is our own money, not the vendor's, so it must never be
          // able to roll back a vend that already happened: guard it like the
          // commission credit below.
          if (cashbackEarned > 0) {
            try {
              await this.walletService.creditBillCashback(
                userId,
                cashbackEarned,
                {
                  billReference: reference,
                  billType: (metadata.type as string) || 'unknown',
                  cashbackPercent,
                  purchaseAmount: amount,
                },
                session,
              );
            } catch (cashbackError) {
              this.logger.error(
                `Failed to credit cashback for ${reference}: ${cashbackError instanceof Error ? cashbackError.message : String(cashbackError)}`,
              );
            }
          }

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
            // The id VTpass needs to answer a `/requery`. Stored so support can
            // re-pull a token or units that were still being generated when the
            // vend returned (`providerDetails.token` missing).
            providerRequestId: purchaseResult.requestId,
            // Receipts and history rows show what the purchase earned, so the
            // amount is stored alongside the purchase details.
            ...(cashbackEarned > 0 ? { cashbackEarned, cashbackPercent } : {}),
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
            createdAt: billTx.createdAt,
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
    dto: {
      amount: number;
      phone: string;
      network: string;
      paymentSource?: BillPaymentSource;
    },
  ) {
    this.assertBillsConfigured();
    const serviceId = AIRTIME_NETWORK_SERVICE[dto.network] || dto.network;
    const cashbackPercent = await this.planCashbackPercent(
      'airtime',
      serviceId,
    );
    return this.executeBillTransaction(
      userId,
      dto.amount,
      BILLS_PROVIDER,
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
      { paymentSource: dto.paymentSource, cashbackPercent },
    );
  }

  async purchaseData(
    userId: string,
    dto: {
      phone: string;
      dataPlanId: string;
      network: string;
      paymentSource?: BillPaymentSource;
    },
  ) {
    this.assertBillsConfigured();
    const { serviceId } = this.dataNetworkEntry(dto.network);
    const plan = await this.resolveLiveDataPlan(dto.network, dto.dataPlanId);
    return this.executeBillTransaction(
      userId,
      plan.amount,
      BILLS_PROVIDER,
      {
        type: 'data',
        variationCode: dto.dataPlanId,
        planName: plan.name,
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
      {
        paymentSource: dto.paymentSource,
        cashbackPercent: plan.cashbackPercent,
      },
    );
  }

  async purchaseCable(
    userId: string,
    dto: {
      serviceProvider: string;
      smartCardNumber: string;
      variationCode: string;
      customerName?: string;
      paymentSource?: BillPaymentSource;
    },
  ) {
    this.assertBillsConfigured();
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!dto.variationCode) {
      throw new BadRequestException('A cable/bouquet plan must be selected');
    }

    // Price comes from the live catalogue, never from the client, and the
    // bouquet must belong to the requested provider (DSTV vs GOTV vs
    // StarTimes), so what the app displayed is exactly what is debited.
    const plan = await this.resolveLiveCablePlan(
      dto.serviceProvider,
      dto.variationCode,
    );

    return this.executeBillTransaction(
      userId,
      plan.amount,
      BILLS_PROVIDER,
      {
        type: 'cable',
        serviceProvider: dto.serviceProvider,
        smartCardNumber: dto.smartCardNumber,
        variationCode: dto.variationCode,
        planName: plan.name,
        ...(dto.customerName ? { customerName: dto.customerName } : {}),
        recipient: dto.smartCardNumber,
      },
      () =>
        this.vtpass.purchaseCable({
          serviceID: dto.serviceProvider,
          billersCode: dto.smartCardNumber,
          amount: plan.amount,
          phone: user.phone,
          variationCode: dto.variationCode,
        }),
      {
        paymentSource: dto.paymentSource,
        cashbackPercent: plan.cashbackPercent,
      },
    );
  }

  /**
   * Renews whatever bouquet a verified decoder is currently on — the action
   * behind the app's "Renew" button on the verified smart card.
   *
   * VTpass prices a renewal from the decoder itself: `merchant-verify` returns
   * the `Renewal_Amount` the provider will bill (which is not always the
   * bouquet's list price — a part-month, an add-on, or a re-price mid-cycle all
   * shift it), and the vend then extends the current bouquet. Nothing is
   * charged until that amount is known, so a member can never be debited for a
   * bouquet they are not on.
   */
  async renewCable(
    userId: string,
    dto: {
      serviceProvider: string;
      smartCardNumber: string;
      customerName?: string;
      /** See `RenewCableDto.expectedAmount`. */
      expectedAmount?: number;
      paymentSource?: BillPaymentSource;
    },
  ) {
    this.assertBillsConfigured();
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const { key, serviceId } = this.cableProviderEntry(dto.serviceProvider);
    const verified = await this.vtpass.verifyProduct({
      serviceID: serviceId,
      billersCode: dto.smartCardNumber,
    });
    if (!verified.valid) {
      throw new BadRequestException(
        verified.message || 'Smart card could not be verified',
      );
    }

    const currentBouquet = (verified.packageInfo ?? '').trim();
    const outstanding = Math.round(Number(verified.outstanding ?? 0));
    const { plans, cashback } = await this.liveCablePlans(key);
    // StarTimes renews by bouquet code (its pay API has no renewal flow of its
    // own), so its current bouquet must resolve to a live plan before charging.
    const current = this.matchCurrentBouquet(
      plans,
      currentBouquet,
      key === 'startimes',
      outstanding,
    );
    if (key === 'startimes' && !current) {
      throw new BadRequestException(
        `Could not find your current StartTimes bouquet (${currentBouquet || 'not reported'}) in the VTpass catalogue. Choose a plan instead.`,
      );
    }

    const renewalAmount =
      outstanding > 0 ? outstanding : (current?.amount ?? 0);
    if (renewalAmount <= 0) {
      throw new BadRequestException(
        'This smart card has no active subscription to renew. Choose a plan to start one.',
      );
    }
    if (
      dto.expectedAmount != null &&
      Math.round(dto.expectedAmount) !== renewalAmount
    ) {
      throw new BadRequestException(
        `The renewal price has changed to ₦${renewalAmount.toLocaleString('en-NG')}. Verify the smart card again to continue.`,
      );
    }

    const customerName = dto.customerName ?? verified.name;
    return this.executeBillTransaction(
      userId,
      renewalAmount,
      BILLS_PROVIDER,
      {
        type: 'cable',
        serviceProvider: key,
        smartCardNumber: dto.smartCardNumber,
        planName: stripPlanPrice(
          current?.name ||
            currentBouquet ||
            `${key.toUpperCase()} subscription`,
        ),
        renewal: true,
        ...(current ? { variationCode: current.variationCode } : {}),
        ...(customerName ? { customerName } : {}),
        recipient: dto.smartCardNumber,
      },
      () =>
        this.vtpass.purchaseCable({
          serviceID: serviceId,
          billersCode: dto.smartCardNumber,
          amount: renewalAmount,
          phone: user.phone,
          // DSTV/GOtv renew from the amount alone; only StarTimes needs the
          // bouquet code (see VTPassService.purchaseCable).
          ...(key === 'startimes' && current
            ? { variationCode: current.variationCode }
            : {}),
          renewCurrentBouquet: true,
        }),
      {
        paymentSource: dto.paymentSource,
        // A renewal has no picked bouquet: the rate comes from the bouquet the
        // decoder is on, matched from VTpass' `Current_Bouquet`.
        cashbackPercent: current
          ? (cashback.get(current.variationCode) ?? 0)
          : 0,
      },
    );
  }

  async purchaseElectricity(
    userId: string,
    dto: {
      disco: string;
      meterNumber: string;
      meterType: string;
      amount: number;
      /** Deprecated: see `PurchaseElectricityDto.phone`. */
      phone?: string;
      customerName?: string;
      paymentSource?: BillPaymentSource;
    },
  ) {
    this.assertBillsConfigured();
    const amount = Math.round(dto.amount);
    if (amount < ELECTRICITY_MIN_AMOUNT || amount > ELECTRICITY_MAX_AMOUNT) {
      throw new BadRequestException(
        `Electricity payments must be between ₦${ELECTRICITY_MIN_AMOUNT} and ₦${ELECTRICITY_MAX_AMOUNT.toLocaleString('en-NG')}`,
      );
    }
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    // VTpass marks `phone` mandatory on the electricity payload — it is where
    // the prepaid token SMS goes — but asking the member to retype a number we
    // already hold is friction, and the account number is the more reliable
    // recipient. The DTO's `phone` stays as a fallback for older builds.
    const accountPhone = (user as { phone?: string }).phone?.trim() ?? '';
    const phone = accountPhone || (dto.phone ?? '').trim();
    if (!phone) {
      throw new BadRequestException(
        'Your profile has no phone number on file. Add one to pay electricity bills.',
      );
    }
    const discoServiceId =
      this.DISCO_SERVICE_ID_MAP[dto.disco.toLowerCase()] ??
      dto.disco.toLowerCase().replace(/\s+/g, '');
    return this.executeBillTransaction(
      userId,
      amount,
      BILLS_PROVIDER,
      {
        type: 'electricity',
        disco: dto.disco,
        meterNumber: dto.meterNumber,
        meterType: dto.meterType,
        ...(dto.customerName ? { customerName: dto.customerName } : {}),
        recipient: dto.meterNumber,
        phone,
      },
      () =>
        this.vtpass.purchaseElectricity({
          serviceID: discoServiceId,
          billersCode: dto.meterNumber,
          amount,
          phone,
          variationCode: dto.meterType,
        }),
      {
        paymentSource: dto.paymentSource,
        cashbackPercent: await this.planCashbackPercent(
          'electricity',
          discoServiceId,
        ),
      },
    );
  }

  /**
   * Validates the member app's network label and resolves its VTpass serviceID.
   */
  private dataNetworkEntry(network: string): {
    key: string;
    serviceId: string;
    bucket: string;
  } {
    const key = (network ?? '').trim().toLowerCase();
    const entry = DATA_NETWORKS[key];
    if (!entry) {
      throw new BadRequestException(
        `Unknown data network "${network}". Supported networks: ${Object.keys(DATA_NETWORKS).join(', ')}`,
      );
    }
    return { key, ...entry };
  }

  /**
   * Validates the app's cable provider label and resolves its VTpass serviceID
   * plus the `bucket` the admin console stores the bouquets under.
   */
  private cableProviderEntry(provider: string): {
    key: string;
    serviceId: string;
    bucket: string;
  } {
    const key = (provider ?? '').trim().toLowerCase();
    const serviceId = CABLE_PROVIDER_SERVICE_IDS[key];
    if (!serviceId) {
      throw new BadRequestException(
        `Unknown cable provider "${provider}". Supported providers: ${CABLE_PROVIDERS.join(', ')}`,
      );
    }
    return { key, serviceId, bucket: key.toUpperCase() };
  }

  /**
   * Pulls a category's plans straight from the VTpass catalogue.
   *
   * VTpass is the single source of truth for plan names and prices; the local
   * `BillServicePlan` copy is only consulted for visibility, so a plan the
   * admin switched OFF in the console stays hidden. The result is cached per
   * `<serviceType>:<label>` for `CATALOGUE_CACHE_TTL_MS` to avoid re-querying
   * VTpass on every screen load.
   */
  /**
   * Pulls a category's plans straight from the VTpass catalogue and applies the
   * admin's overlays to them.
   *
   * VTpass is the single source of truth for plan names and prices, and its
   * response is cached per `<serviceType>:<label>` for `CATALOGUE_CACHE_TTL_MS`
   * to avoid re-querying the vendor on every screen load.
   *
   * The overlays — which plans the admin switched OFF and what each plan pays
   * back — are deliberately **not** cached: they are read from
   * `BillServicePlan` on every call. Caching them alongside the vendor list
   * meant a cashback rate saved in the console could stay invisible on the
   * member's plan cards for the rest of the cache window, which looks exactly
   * like "the setting didn't save".
   */
  private async liveCatalogue(params: {
    serviceType: 'data' | 'cable';
    /** Cache key — the app's label, e.g. `mtn` or `dstv`. */
    key: string;
    serviceId: string;
    /** Stored `BillServicePlan.bucket` (`MTN`, `DSTV`, …), matched case-insensitively. */
    bucket: string;
  }): Promise<LiveCatalogue> {
    const cacheKey = `${params.serviceType}:${params.key}`;
    const cached = this.catalogueCache.get(cacheKey);

    let variations: ServiceVariation[];
    if (cached && Date.now() - cached.fetchedAt < CATALOGUE_CACHE_TTL_MS) {
      variations = cached.plans;
    } else {
      variations = await this.vtpass.getServiceVariations(params.serviceId);
      this.catalogueCache.set(cacheKey, {
        fetchedAt: Date.now(),
        plans: variations,
      });
    }

    const { offIds, cashback } = await this.planOverlay(
      params.serviceType,
      params.bucket,
    );

    const plans = variations
      .filter((variation) => !offIds.has(variation.variationCode))
      .sort((a, b) => a.amount - b.amount);

    return { plans, cashback };
  }

  /**
   * The admin's per-plan settings for one category — hidden plan codes and the
   * cashback rate each plan pays. One indexed query serves both, so it is cheap
   * enough to run on every catalogue read instead of being cached.
   */
  private async planOverlay(
    serviceType: 'data' | 'cable',
    bucket: string,
  ): Promise<{ offIds: Set<string>; cashback: Map<string, number> }> {
    const rows = await this.servicePlanModel
      .find({
        serviceType,
        provider: BILLS_PROVIDER,
        bucket: { $regex: `^${bucket}$`, $options: 'i' },
      })
      .lean();

    return {
      offIds: new Set(
        rows
          .filter((row) => row.isActive === false)
          .map((row) => row.externalId),
      ),
      cashback: new Map<string, number>(
        rows.map((row) => [
          row.externalId,
          clampCashbackPercent(row.cashbackPercent),
        ]),
      ),
    };
  }

  /** Live data plans for a network (`mtn-data`, `etisalat-data`, …). */
  private liveDataPlans(network: string): Promise<LiveCatalogue> {
    const { key, serviceId, bucket } = this.dataNetworkEntry(network);
    return this.liveCatalogue({ serviceType: 'data', key, serviceId, bucket });
  }

  /** Live cable bouquets for a provider (`dstv`, `gotv`, `startimes`). */
  private liveCablePlans(provider: string): Promise<LiveCatalogue> {
    const { key, serviceId, bucket } = this.cableProviderEntry(provider);
    return this.liveCatalogue({ serviceType: 'cable', key, serviceId, bucket });
  }

  /**
   * Finds the bouquet a decoder is currently subscribed to.
   *
   * `Current_Bouquet` comes back as a bouquet name — sometimes the catalogue
   * name with its price ("DStv Compact N19,000"), sometimes without the
   * provider prefix — so both sides are reduced to plain words before
   * comparing. A StartTimes bouquet ("Nova") is sold in several durations, so
   * `amountHint` (the verified renewal amount) breaks the tie. `requireExact`
   * is used for StarTimes, where the match decides which bouquet code is
   * renewed and a guess could renew the wrong one.
   */
  private matchCurrentBouquet(
    plans: ServiceVariation[],
    currentBouquet: string | undefined,
    requireExact = false,
    amountHint = 0,
  ): ServiceVariation | undefined {
    const target = bouquetKey(currentBouquet);
    if (!target) return undefined;

    const keyed = plans
      .map((plan) => ({ plan, key: bouquetKey(stripPlanPrice(plan.name)) }))
      .filter((entry) => entry.key.length > 0);

    const exact = keyed.find((entry) => entry.key === target);
    if (exact) return exact.plan;

    // Fall back to containment: VTpass reports "Compact" for "DStv Compact".
    let candidates = keyed.filter(
      (entry) => entry.key.includes(target) || target.includes(entry.key),
    );
    if (candidates.length > 1 && amountHint > 0) {
      const byAmount = candidates.filter(
        (entry) => Math.round(entry.plan.amount) === Math.round(amountHint),
      );
      if (byAmount.length > 0) candidates = byAmount;
    }
    if (requireExact && candidates.length !== 1) return undefined;
    return candidates[0]?.plan;
  }

  /**
   * Prices a data purchase from the same live catalogue the member app shows,
   * so the amount debited always matches the amount displayed. A code that is
   * not in the catalogue is rejected; an admin-disabled plan keeps its
   * "currently unavailable" message.
   */
  private async resolveLiveDataPlan(
    network: string,
    variationCode: string,
  ): Promise<{ name: string; amount: number; cashbackPercent: number }> {
    if (!variationCode) {
      throw new BadRequestException('A data plan must be selected');
    }
    const { bucket } = this.dataNetworkEntry(network);

    const { plans: live, cashback } = await this.liveDataPlans(network);
    const match = live.find(
      (variation) => variation.variationCode === variationCode,
    );
    if (match)
      return {
        name: match.name,
        amount: match.amount,
        cashbackPercent: cashback.get(match.variationCode) ?? 0,
      };

    const stored = await this.servicePlanModel
      .findOne({
        serviceType: 'data',
        provider: BILLS_PROVIDER,
        externalId: variationCode,
        bucket: { $regex: `^${bucket}$`, $options: 'i' },
      })
      .lean();
    if (stored && !stored.isActive) {
      throw new BadRequestException(`${stored.name} is currently unavailable`);
    }
    throw new BadRequestException('Invalid data plan selected');
  }

  /**
   * Data plans for a network, fetched live from the VTpass
   * `service-variations` catalogue. Nothing but the admin's on/off toggles is
   * read from the local database, so new plans and price changes from VTpass
   * reach the member app as soon as the short-lived cache expires.
   */
  async getDataPlans(network: string) {
    this.assertBillsConfigured();
    const { plans, cashback } = await this.liveDataPlans(network);
    return plans.map((plan) => ({
      variationCode: plan.variationCode,
      name: plan.name,
      amount: plan.amount,
      fixedPrice: plan.fixedPrice,
      // Rendered on the plan card ("₦0.5 back") so the member sees the reward
      // before choosing a bundle.
      cashbackPercent: cashback.get(plan.variationCode) ?? 0,
      cashback: cashbackFor(plan.amount, cashback.get(plan.variationCode)),
    }));
  }

  /**
   * Cable bouquets for a provider, fetched live from the VTpass
   * `service-variations` catalogue — same contract as `getDataPlans`.
   *
   * The old implementation served the synced `BillServicePlan` rows, so a
   * bouquet VTpass added (or re-priced) stayed invisible in the app until an
   * admin sync, and a bouquet VTpass retired stayed sellable. Now only the
   * admin's on/off toggles are read from the database, so the app shows the
   * same list that `purchaseCable` prices against.
   */
  async getCablePlans(provider: string) {
    this.assertBillsConfigured();
    const { plans, cashback } = await this.liveCablePlans(provider);
    return plans.map((plan) => ({
      variationCode: plan.variationCode,
      name: stripPlanPrice(plan.name),
      amount: plan.amount,
      fixedPrice: plan.fixedPrice,
      cashbackPercent: cashback.get(plan.variationCode) ?? 0,
      cashback: cashbackFor(plan.amount, cashback.get(plan.variationCode)),
    }));
  }

  /**
   * Quotes the cashback a member would earn on a purchase they are about to
   * confirm — the "You'll earn ₦0.5 cashback" banner on the app's confirm
   * screen.
   *
   * Data and cable plans are priced from the live catalogue (the same source
   * the purchase uses), so the quote can never drift from what is charged;
   * airtime and electricity are quoted on the amount the member entered.
   */
  async estimateCashback(params: {
    serviceType: 'airtime' | 'data' | 'cable' | 'electricity';
    provider?: string;
    variationCode?: string;
    /** Airtime/electricity amount, or the amount of a cable renewal. */
    amount?: number;
    /** Cable renewals: the bouquet VTpass says the decoder is on. */
    packageName?: string;
  }) {
    this.assertBillsConfigured();
    const requested = Math.round(Number(params.amount ?? 0) || 0);
    const provider = (params.provider ?? '').trim();

    let purchaseAmount = requested;
    let cashbackPercent = 0;

    if (params.serviceType === 'data') {
      const plan = await this.resolveLiveDataPlan(
        provider,
        params.variationCode ?? '',
      );
      purchaseAmount = plan.amount;
      cashbackPercent = plan.cashbackPercent;
    } else if (params.serviceType === 'cable') {
      if (params.variationCode) {
        const plan = await this.resolveLiveCablePlan(
          provider,
          params.variationCode,
        );
        purchaseAmount = plan.amount;
        cashbackPercent = plan.cashbackPercent;
      } else {
        // A renewal has no picked bouquet: the rate follows the bouquet the
        // decoder is on, matched from the name VTpass reported.
        const { plans, cashback } = await this.liveCablePlans(provider);
        const current = this.matchCurrentBouquet(
          plans,
          params.packageName,
          false,
          requested,
        );
        cashbackPercent = current
          ? (cashback.get(current.variationCode) ?? 0)
          : 0;
      }
    } else if (params.serviceType === 'airtime') {
      const serviceId = AIRTIME_NETWORK_SERVICE[provider] || provider;
      cashbackPercent = await this.planCashbackPercent('airtime', serviceId);
    } else {
      const discoServiceId =
        this.DISCO_SERVICE_ID_MAP[provider.toLowerCase()] ??
        provider.toLowerCase().replace(/\s+/g, '');
      cashbackPercent = await this.planCashbackPercent(
        'electricity',
        discoServiceId,
      );
    }

    return {
      serviceType: params.serviceType,
      purchaseAmount,
      cashbackPercent,
      cashback: cashbackFor(purchaseAmount, cashbackPercent),
    };
  }

  /**
   * Returns the service categories the member app should surface.
   *
   * All four categories are offered, but one the admin has fully switched OFF
   * (plans synced, none of them `isActive`) is hidden — otherwise the app shows
   * a tile whose purchase can only fail. Categories that were never synced stay
   * visible because `getDataPlans` / `getCablePlans` bootstrap from the live
   * VTpass catalogue.
   */
  async getActiveServiceTypes(): Promise<string[]> {
    const stats = await this.servicePlanModel.aggregate<{
      _id: string;
      total: number;
      active: number;
    }>([
      {
        $match: { provider: BILLS_PROVIDER },
      },
      {
        $group: {
          _id: '$serviceType',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
    ]);
    const byType = new Map(stats.map((stat) => [stat._id, stat]));

    return BILL_SERVICE_TYPES.filter((serviceType) => {
      const stat = byType.get(serviceType);
      if (!stat) return true;
      return stat.active > 0;
    });
  }

  // ---- Platform-admin: catalogue management --------------------------------

  /**
   * Catalogue status for every bill category — one row per category in the
   * admin console. VTPass is the only provider, so there is no routing to
   * configure: the only actions are "sync" and per-plan on/off.
   */
  async listCatalogStatus() {
    const configs = await this.providerConfigModel.find({}).lean();
    const counts = await this.servicePlanModel.aggregate<{
      _id: string;
      total: number;
      active: number;
    }>([
      {
        $match: { provider: BILLS_PROVIDER },
      },
      {
        $group: {
          _id: '$serviceType',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
    ]);
    const byType = new Map(counts.map((count) => [count._id, count]));

    return BILL_SERVICE_TYPES.map((serviceType) => {
      const cfg = configs.find((c) => c.serviceType === serviceType);
      const stat = byType.get(serviceType);
      return {
        serviceType,
        lastSyncedAt: cfg?.lastSyncedAt ?? undefined,
        lastSyncStatus: cfg?.lastSyncStatus ?? 'never',
        planTotal: stat?.total ?? 0,
        planActive: stat?.active ?? 0,
        configured: Boolean(cfg),
      };
    });
  }

  /**
   * Pulls plans from the VTpass catalogue and upserts them into
   * `BillServicePlan`, preserving existing admin on/off toggles.
   */
  async syncPlans(serviceType: string) {
    this.assertBillsConfigured();
    const provider = BILLS_PROVIDER;
    const plans = await this.vtpassCatalog(serviceType);

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
          $setOnInsert: { isActive: true },
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
      bucket?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    // Only the active provider's rows are shown: legacy rows from a retired
    // provider (e.g. the old "gladtidings" catalogue) can never reach a member,
    // so a cashback rate or on/off toggle set on one would silently do nothing.
    const filter: Record<string, unknown> = { provider: BILLS_PROVIDER };
    if (query.serviceType) filter.serviceType = query.serviceType;
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
        // VTpass bouquet names carry the price ("DStv Compact N19,000") and
        // the console renders the amount in its own column — strip it so the
        // admin sees the same name members do.
        name: p.serviceType === 'cable' ? stripPlanPrice(p.name) : p.name,
        bucket: p.bucket,
        amount: p.amount,
        fixedPrice: p.fixedPrice,
        isActive: p.isActive,
        /** Rate set by the admin for this plan (0 = no cashback). */
        cashbackPercent: clampCashbackPercent(p.cashbackPercent),
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

  /**
   * Sets the cashback rate for one plan row — the admin console's "Cashback %"
   * column. Every category is configured the same way: data plans, airtime
   * networks, cable bouquets and electricity discos each have their own row.
   * `0` switches cashback off for that plan.
   */
  async setPlanCashback(id: string, cashbackPercent: number) {
    if (!Number.isFinite(cashbackPercent)) {
      throw new BadRequestException('Cashback percentage must be a number');
    }
    if (cashbackPercent < 0 || cashbackPercent > 100) {
      throw new BadRequestException(
        'Cashback percentage must be between 0 and 100',
      );
    }

    const plan = await this.servicePlanModel.findById(id);
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.provider !== BILLS_PROVIDER) {
      // Legacy rows from a retired provider are never served to members, so a
      // rate set on one would silently never pay out.
      throw new BadRequestException(
        `This plan belongs to a retired provider (${plan.provider}) and is not sold to members`,
      );
    }

    // Two decimals is all a percentage needs; keeps ₦ amounts clean when the
    // rate is applied to a purchase.
    plan.cashbackPercent = Math.round(cashbackPercent * 100) / 100;
    await plan.save();

    return {
      id: plan._id.toString(),
      serviceType: plan.serviceType,
      name: plan.name,
      bucket: plan.bucket,
      cashbackPercent: plan.cashbackPercent,
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
    createdAt?: Date;
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
      createdAt: raw.createdAt?.toISOString(),
    };
  }

  /**
   * Returns the signing user's bill receipts, newest first. `serviceType`
   * narrows the list to one category — the filter tabs on the history screen.
   * Filtering happens in the query so the 100-row cap applies *after* it: the
   * "Data" tab shows the member's 100 newest data receipts, not whichever
   * data rows happen to fall inside their 100 newest payments overall.
   */
  async getHistory(
    userId: string,
    query: { serviceType?: string } = {},
  ): Promise<BillReceipt[]> {
    const filter: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
    };
    if (query.serviceType) filter.type = query.serviceType;

    const txns = await this.billTransactionModel
      .find(filter)
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
        createdAt: t.createdAt,
      }),
    );
  }

  /**
   * Returns a single receipt owned by the given user. The reference is the
   * internal `bill_<uuid>` reference assigned at purchase time.
   */
  async getReceipt(userId: string, reference: string): Promise<BillReceipt> {
    const txn = await this.billTransactionModel
      .findOne({ user: new Types.ObjectId(userId), reference })
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
      createdAt: txn.createdAt,
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
