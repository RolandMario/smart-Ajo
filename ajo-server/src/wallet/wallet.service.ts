import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Wallet, WalletDocument } from './schemas/wallet.schema';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from './schemas/wallet-transaction.schema';
import {
  WalletTransactionStatus,
  WalletTransactionType,
} from '../common/enums/wallet.enum';
import { UsersService } from '../users/users.service';
import { DedicatedAccount } from '../users/schemas/dedicated-account.schema';
import {
  BankListEntry,
  DedicatedAccountResult,
  PaystackService,
} from '../payments/paystack.service';
import { BankAccount } from '../users/schemas/bank-account.schema';
import { SetBankAccountDto } from './dto/set-bank-account.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';
import { toE164Nigeria } from '../common/utils/phone';

export interface PaginatedWalletTransactions {
  transactions: WalletTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Which wallet balance funds a bill purchase. */
export type BillPaymentSource = 'main' | 'cashback';

/**
 * Rounds a naira amount to 2 dp. Cashback is a percentage of the purchase, so
 * balances regularly carry fractions (₦100 × 0.5% = ₦0.50) and must not drift
 * into floating-point noise.
 */
function roundNaira(amount: number): number {
  return Math.round(amount * 100) / 100;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(WalletTransaction.name)
    private walletTxModel: Model<WalletTransactionDocument>,
    @InjectConnection() private connection: Connection,
    private usersService: UsersService,
    private paystack: PaystackService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // ---- Shared error helpers -------------------------------------------------

  /** Mongo duplicate-key error (E11000), possibly wrapped by the driver. */
  private isDuplicateKeyError(err: unknown): boolean {
    const error = err as {
      code?: number | string;
      message?: string;
      err?: { code?: number | string };
    } | null;
    const code = error?.code ?? error?.err?.code;
    const message = String(error?.message ?? err);
    return code === 11000 || code === '11000' || message.includes('E11000');
  }

  // ---- Wallet basics ---------------------------------------------------------

  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    const userObjectId = new Types.ObjectId(userId);
    let wallet = await this.walletModel.findOne({ user: userObjectId });

    if (!wallet) {
      wallet = await this.walletModel.create({
        user: userObjectId,
        balance: 0,
      });
    }

    return wallet;
  }

  async getWalletSummary(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const user = await this.usersService.findById(userId);

    const recentTransactions = await this.walletTxModel
      .find({ user: wallet.user })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      balance: wallet.balance ?? 0,
      /** Cashback earned on bills — shown as its own wallet on the profile. */
      cashbackBalance: wallet.cashbackBalance ?? 0,
      currency: wallet.currency,
      recentTransactions,
      dedicatedAccount: user?.dedicatedAccount?.active
        ? {
            paystackCustomerCode: user.dedicatedAccount.paystackCustomerCode,
            accountNumber: user.dedicatedAccount.accountNumber,
            accountName: user.dedicatedAccount.accountName,
            bankName: user.dedicatedAccount.bankName,
            provider: user.dedicatedAccount.provider,
            currency: user.dedicatedAccount.currency,
            active: true,
          }
        : null,
    };
  }

  // ---- Transactions (member transaction history) -----------------------------

  /**
   * Paginated, member-scoped wallet ledger — newest first. Powers the
   * mobile wallet's Transactions screen.
   */
  async listTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedWalletTransactions> {
    const wallet = await this.getOrCreateWallet(userId);

    const filter = { user: wallet.user };

    const [transactions, total] = await Promise.all([
      this.walletTxModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.walletTxModel.countDocuments(filter),
    ]);

    return {
      transactions,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ---- Cashback wallet -------------------------------------------------------

  /**
   * The member's cashback wallet: its balance plus the ledger rows that moved
   * it (earned on a bill, or spent on one). Powers the mobile
   * `CashbackWallet` screen opened from the profile.
   */
  async getCashbackWallet(userId: string, limit: number = 50) {
    const wallet = await this.getOrCreateWallet(userId);

    const transactions = await this.walletTxModel
      .find({
        user: wallet.user,
        type: {
          $in: [
            WalletTransactionType.CASHBACK_CREDIT,
            WalletTransactionType.CASHBACK_DEBIT,
          ],
        },
        status: WalletTransactionStatus.SUCCESS,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      balance: wallet.cashbackBalance ?? 0,
      currency: wallet.currency,
      transactions,
    };
  }

  // ---- Funding (top-up) ------------------------------------------------------

  /**
   * Starts a wallet funding transaction. The member completes payment by
   * opening `authorizationUrl`. The wallet is credited once
   * `/webhooks/paystack` receives `charge.success` (or via
   * `GET /wallet/fund/verify/:reference` as a fallback).
   */
  async initializeFunding(userId: string, amountNaira: number) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email) {
      throw new BadRequestException(
        'An email address is required to fund your wallet. Add one via PATCH /auth/me first.',
      );
    }

    const wallet = await this.getOrCreateWallet(userId);
    const reference = `fund_${randomUUID()}`;

    const { authorizationUrl } = await this.paystack.initializeTransaction(
      user.email,
      amountNaira,
      reference,
    );

    // Create a PENDING ledger entry so the webhook/verify step has
    // something to reconcile against. balance is unchanged until
    // confirmed.
    await this.walletTxModel.create({
      wallet: wallet._id,
      user: wallet.user,
      type: WalletTransactionType.FUNDING,
      status: WalletTransactionStatus.PENDING,
      amount: amountNaira,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      reference,
    });

    return { authorizationUrl, reference };
  }

  /**
   * Fallback to the webhook: confirms a funding transaction by reference
   * directly with Paystack and credits the wallet if successful.
   */
  async verifyFunding(userId: string, reference: string) {
    const result = await this.paystack.verifyTransaction(reference);

    if (result.status === 'success') {
      await this.confirmFunding(reference, result.amount / 100, {
        source: 'manual_verify',
      });
    } else if (result.status === 'failed' || result.status === 'abandoned') {
      await this.failFunding(reference);
    }

    return this.getWalletSummary(userId);
  }

  /**
   * Idempotently credits a wallet for a successful funding transaction.
   * Called from both `verifyFunding` (manual) and the Paystack webhook
   * (`charge.success`) — safe to call multiple times for the same
   * reference.
   *
   * Returns `true` when a PENDING funding entry was found and credited
   * (the card top-up path), or `false` when the reference is unknown or
   * was already processed (e.g. a Dedicated Virtual Account transfer,
   * which has no PENDING entry — see `creditDedicatedAccountFunding`).
   */
  async confirmFunding(
    reference: string,
    amountNaira: number,
    metadata?: Record<string, unknown>,
  ): Promise<boolean> {
    const session = await this.connection.startSession();

    let processed = false;
    let notifyUserId: string | undefined;
    let notifyNewBalance: number | undefined;

    try {
      await session.withTransaction(async () => {
        const tx = await this.walletTxModel
          .findOne({ reference })
          .session(session);

        if (!tx || tx.status === WalletTransactionStatus.SUCCESS) {
          // Unknown reference, or already processed by a prior webhook/verify call.
          return;
        }

        const wallet = await this.walletModel
          .findById(tx.wallet)
          .session(session);

        if (!wallet) {
          return;
        }

        const balanceBefore = wallet.balance ?? 0;
        const balanceAfter = balanceBefore + amountNaira;

        wallet.balance = balanceAfter;
        await wallet.save({ session });

        tx.status = WalletTransactionStatus.SUCCESS;
        tx.amount = amountNaira;
        tx.balanceBefore = balanceBefore;
        tx.balanceAfter = balanceAfter;
        if (metadata) {
          tx.metadata = metadata;
        }
        await tx.save({ session });

        processed = true;
        notifyUserId = tx.user.toString();
        notifyNewBalance = balanceAfter;
      });
    } finally {
      await session.endSession();
    }

    if (notifyUserId !== undefined && notifyNewBalance !== undefined) {
      void this.notificationsService.send(
        NotificationEvents.walletFunded({
          userIds: [notifyUserId],
          amount: amountNaira,
          newBalance: notifyNewBalance,
        }),
      );
    }

    return processed;
  }

  async failFunding(reference: string): Promise<void> {
    await this.walletTxModel.updateOne(
      { reference, status: WalletTransactionStatus.PENDING },
      { $set: { status: WalletTransactionStatus.FAILED } },
    );
  }

  // ---- Dedicated virtual account (DVA) ---------------------------------------

  /**
   * Returns the member's OWN Paystack Dedicated Virtual Account, creating it
   * lazily on first use (mirrors `getOrCreateWallet`) and storing it on the
   * user.
   *
   * "Own" is deliberate: Ajo never adopts a customer that another product on
   * the same Paystack integration already used to mint a virtual account.
   * A shared account number would let one transfer be credited by two
   * ledgers (or by neither), so every member gets an Ajo-tagged Paystack
   * customer — with a deterministic `+ajo…` email alias when their real email
   * already belongs to such a customer — and a virtual account of their own.
   *
   * Idempotent: an active account minted with the current Paystack mode is
   * returned as-is; a test-mode code is discarded once the server switches to
   * a live key (Paystack keeps separate customer lists per mode, so the old
   * code answers "Customer not found").
   */
  async getOrCreateDedicatedAccount(userId: string): Promise<DedicatedAccount> {
    this.paystack.assertConfigured();

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phone) {
      throw new BadRequestException(
        'A verified phone number is required before a dedicated account can be created',
      );
    }

    const mode = this.paystack.keyMode();
    const stored = user.dedicatedAccount;

    if (stored?.active && stored.accountNumber) {
      if (stored.paystackMode === mode) {
        return stored;
      }

      // Records created before `paystackMode` existed have an active number but
      // no mode. Keep that number — members may already be transferring to it —
      // by verifying the customer still exists in the current mode and
      // backfilling the mode, instead of minting a second account.
      if (!stored.paystackMode && stored.paystackCustomerCode) {
        const existing = await this.paystack.fetchCustomer(
          stored.paystackCustomerCode,
        );

        if (existing) {
          stored.paystackMode = mode;
          user.dedicatedAccount = stored;
          await user.save();

          return stored;
        }
      }
    }

    if (!user.email) {
      throw new BadRequestException(
        'An email address is required to create a dedicated account. Add one via PATCH /auth/me first.',
      );
    }

    const { firstName, lastName } = this.splitName(user.name);

    if (!firstName) {
      throw new BadRequestException(
        'Add your full name in Profile before creating a dedicated account — Paystack uses it for the account name.',
      );
    }

    // 1. Resolve the Paystack customer Ajo owns for this member.
    const customer = await this.resolveAjoCustomer(user, mode, stored);

    // Persist the customer code immediately so a later failure can be
    // retried without creating a duplicate Paystack customer.
    if (
      customer.customerCode !== stored?.paystackCustomerCode ||
      stored?.paystackMode !== mode
    ) {
      user.dedicatedAccount = {
        paystackCustomerCode: customer.customerCode,
        paystackCustomerEmail: customer.email,
        paystackMode: mode,
        provider: 'paystack',
        currency: 'NGN',
        active: false,
      };
      await user.save();
    }

    // 2. Request the virtual account.
    const phone = toE164Nigeria(user.phone) as string;
    let result: DedicatedAccountResult;

    try {
      result = await this.paystack.createDedicatedAccount({
        customerCode: customer.customerCode,
        preferredBank: this.paystack.dvaPreferredBank(),
        phone,
        firstName,
        lastName,
      });
    } catch (err) {
      // The customer may already have a DVA (e.g. a previous attempt
      // succeeded on Paystack's side but failed to persist). Recover the
      // existing assignment instead of erroring out.
      const existing = await this.paystack
        .fetchDedicatedAccounts(customer.customerCode)
        .catch(() => [] as DedicatedAccountResult[]);

      const adopted =
        existing.find((dva) => dva.active && dva.accountNumber) ??
        existing.find((dva) => dva.accountNumber);

      if (!adopted) {
        throw err;
      }

      result = adopted;
    }

    if (!result.accountNumber) {
      throw new BadRequestException(
        'Paystack did not return an account number. Please try again in a moment.',
      );
    }

    const dedicatedAccount: DedicatedAccount = {
      paystackCustomerCode: customer.customerCode,
      paystackCustomerEmail: customer.email,
      paystackMode: mode,
      paystackAccountId: result.accountId,
      accountNumber: result.accountNumber,
      accountName: result.accountName,
      bankName: result.bankName,
      provider: 'paystack',
      currency: result.currency || 'NGN',
      active: result.active,
    };

    user.dedicatedAccount = dedicatedAccount;
    await user.save();

    return dedicatedAccount;
  }

  /**
   * Requests a new virtual account number (e.g. if the previous one was
   * invalidated by Paystack). Best-effort: if we can't deactivate the old
   * assignment, the existing number is returned unchanged.
   */
  async refreshDedicatedAccount(userId: string): Promise<DedicatedAccount> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stored = user.dedicatedAccount;

    if (stored?.active && stored.accountNumber) {
      stored.active = false;

      if (stored.paystackAccountId) {
        try {
          await this.paystack.deactivateDedicatedAccount(
            stored.paystackAccountId,
          );
          stored.paystackAccountId = undefined;
        } catch {
          // Paystack refused the deactivation — getOrCreateDedicatedAccount
          // will recover the existing assignment below.
        }
      }

      user.dedicatedAccount = stored;
      await user.save();
    }

    return this.getOrCreateDedicatedAccount(userId);
  }

  /**
   * Credits a wallet for an inbound bank transfer into the member's
   * Dedicated Virtual Account. Unlike card top-ups there is no PENDING
   * ledger entry — the funds already settled — so the credit is created
   * as SUCCESS in one step. Idempotent: `reference` is unique on
   * `WalletTransaction`, and a second webhook for the same transfer is
   * skipped.
   *
   * The member is resolved from every identity Paystack sends, in order of
   * reliability: the Ajo-owned customer code, the virtual account number,
   * then the phone. Phone matching normalises Nigerian formats
   * (`07068497568` vs `+2347068497568`) — a plain equality check silently
   * dropped every transfer.
   *
   * Returns `true` when a credit was applied, `false` if no member matches or
   * the reference was already processed.
   */
  async creditDedicatedAccountFunding(params: {
    customerCode?: string;
    accountNumber?: string;
    phone?: string;
    amountNaira: number;
    reference: string;
    paystackData?: Record<string, unknown>;
  }): Promise<boolean> {
    const user = await this.usersService.findByDedicatedAccountIdentity({
      customerCode: params.customerCode,
      accountNumber: params.accountNumber,
      phone: params.phone,
    });

    if (!user) {
      this.logger.warn(
        `Dedicated account funding: no member matched ` +
          `(customer=${params.customerCode ?? 'n/a'}, account=${params.accountNumber ?? 'n/a'}, phone=${params.phone ?? 'n/a'})`,
      );

      return false;
    }

    const existing = await this.walletTxModel.findOne({
      reference: params.reference,
    });

    if (existing) {
      // Already credited by a prior webhook delivery.
      return false;
    }

    const wallet = await this.getOrCreateWallet(user._id.toString());
    const balanceBefore = wallet.balance ?? 0;
    const balanceAfter = balanceBefore + params.amountNaira;

    wallet.balance = balanceAfter;
    await wallet.save();

    await this.walletTxModel.create({
      wallet: wallet._id,
      user: wallet.user,
      type: WalletTransactionType.FUNDING,
      status: WalletTransactionStatus.SUCCESS,
      amount: params.amountNaira,
      balanceBefore,
      balanceAfter,
      reference: params.reference,
      metadata: {
        source: 'dedicated_account',
        ...(params.paystackData ?? {}),
      },
    });

    void this.notificationsService.send(
      NotificationEvents.walletFunded({
        userIds: [user._id.toString()],
        amount: params.amountNaira,
        newBalance: balanceAfter,
      }),
    );

    return true;
  }

  private splitName(name?: string): {
    firstName?: string;
    lastName?: string;
  } {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return {};
    return {
      firstName: parts[0],
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
    };
  }

  /**
   * Finds (or mints) the Paystack customer Ajo will attach the member's
   * virtual account to.
   *
   * 1. Reuse a customer code we minted before, as long as Paystack still
   *    knows it in the current mode.
   * 2. If the member's email already has a Paystack customer WITHOUT an
   *    active virtual account, reuse it — nothing is shared, because Ajo
   *    creates the only DVA on it.
   * 3. If that customer already has an active virtual account (created by
   *    another product on the same Paystack business), mint a NEW customer
   *    under a deterministic `+ajo…` alias of the member's email so Ajo's
   *    account number is separate.
   * 4. Otherwise create a fresh Ajo-tagged customer with their real email.
   */
  private async resolveAjoCustomer(
    user: {
      _id: Types.ObjectId;
      name?: string;
      email?: string;
    },
    mode: 'test' | 'live',
    stored?: DedicatedAccount,
  ): Promise<{ customerCode: string; email?: string }> {
    if (stored?.paystackCustomerCode && stored.paystackMode === mode) {
      const existing = await this.paystack.fetchCustomer(
        stored.paystackCustomerCode,
      );

      if (existing) {
        return {
          customerCode: existing.customerCode,
          email: stored.paystackCustomerEmail,
        };
      }

      // Customer deleted on the dashboard — mint a fresh one below.
    }

    const email = user.email?.trim().toLowerCase();

    if (!email) {
      throw new BadRequestException(
        'An email address is required to create a dedicated account. Add one via PATCH /auth/me first.',
      );
    }

    const existingCustomer = await this.paystack.fetchCustomerByEmail(email);

    if (!existingCustomer) {
      return this.createAjoCustomer(user, email);
    }

    const accounts = await this.paystack
      .fetchDedicatedAccounts(existingCustomer.customerCode)
      .catch(() => [] as DedicatedAccountResult[]);

    if (!accounts.some((dva) => dva.active)) {
      return { customerCode: existingCustomer.customerCode, email };
    }

    // The email is already used by a customer that owns a virtual account
    // from another product on this Paystack integration. Reusing it would
    // mean Ajo and that product share one account number, so Ajo gets its
    // own customer under a plus-alias of the member's email.
    const alias = this.ajoAliasEmail(email, user._id.toString());

    this.logger.warn(
      `Paystack customer for ${email} already owns a dedicated account — ` +
        `provisioning a separate Ajo customer (${alias}) for user ${user._id.toString()}`,
    );

    const existingAlias = await this.paystack.fetchCustomerByEmail(alias);

    if (existingAlias) {
      return { customerCode: existingAlias.customerCode, email: alias };
    }

    return this.createAjoCustomer(user, alias);
  }

  /**
   * Creates a Paystack customer tagged with `metadata.app = 'ajo'`. If
   * Paystack refuses the email as a duplicate (race with a concurrent
   * request, or the lookup above missed it), the existing customer is reused
   * so provisioning still succeeds.
   */
  private async createAjoCustomer(
    user: { _id: Types.ObjectId; name?: string },
    email: string,
  ): Promise<{ customerCode: string; email?: string }> {
    const { firstName, lastName } = this.splitName(user.name);

    try {
      const { customerCode } = await this.paystack.createCustomer({
        firstName,
        lastName,
        email,
        // No phone: two products on one integration can legitimately share a
        // phone number, and the DVA request carries the phone itself.
        metadata: { app: 'ajo', userId: user._id.toString() },
      });

      return { customerCode, email };
    } catch (err) {
      if (!this.paystack.isDuplicateCustomerError(err)) {
        throw err;
      }

      const existing = await this.paystack.fetchCustomerByEmail(email);

      if (!existing) {
        throw err;
      }

      return { customerCode: existing.customerCode, email };
    }
  }

  /**
   * Deterministic plus-alias of a member's email, used to mint a Paystack
   * customer that no other product on the integration owns:
   * `jane@example.com` → `jane+ajo1a2b3c@example.com`. Gmail-style plus
   * addressing still delivers to the member's inbox.
   */
  private ajoAliasEmail(email: string, userId: string): string {
    const at = email.lastIndexOf('@');
    const local = (at > 0 ? email.slice(0, at) : email).split('+')[0];
    const domain = at > 0 ? email.slice(at) : '@ajo.app';
    const tag =
      userId
        .replace(/[^a-z0-9]/gi, '')
        .slice(-6)
        .toLowerCase() || 'account';

    return `${local}+ajo${tag}${domain}`;
  }

  // ---- Bank account (payout destination) -------------------------------------

  async listBanks(): Promise<BankListEntry[]> {
    return this.paystack.listBanks();
  }

  /**
   * Resolves the given account number/bank code with Paystack, creates a
   * transfer recipient, and saves the result as the user's payout bank
   * account.
   */
  async setBankAccount(
    userId: string,
    dto: SetBankAccountDto,
  ): Promise<BankAccount> {
    const resolved = await this.paystack.resolveAccountNumber(
      dto.accountNumber,
      dto.bankCode,
    );

    const recipient = await this.paystack.createTransferRecipient({
      accountNumber: resolved.accountNumber,
      bankCode: dto.bankCode,
      accountName: resolved.accountName,
    });

    const bankAccount: BankAccount = {
      bankCode: dto.bankCode,
      bankName: dto.bankName,
      accountNumber: resolved.accountNumber,
      accountName: resolved.accountName,
      paystackRecipientCode: recipient.recipientCode,
    };

    const user = await this.usersService.setBankAccount(userId, bankAccount);

    return user.bankAccount!;
  }

  async getBankAccount(userId: string): Promise<BankAccount | null> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.bankAccount ?? null;
  }

  // ---- Contribution debits (used by CyclesService) -----------------------------

  /**
   * Attempts to debit `amountNaira` from the member's wallet for a cycle
   * contribution. Optionally also debits a service fee. Crediting the
   * group's central account and platform wallet is the CALLER's
   * responsibility (see CyclesService) — this method only handles the
   * member's side of the ledger, within the caller's transaction.
   *
   * Returns `true` if the debit succeeded (sufficient balance — the
   * wallet was debited and ledger entries recorded), or `false` if the
   * balance was insufficient (no changes made, the contribution remains
   * PENDING).
   */
  async debitForContribution(
    userId: Types.ObjectId,
    amountNaira: number,
    refs: {
      group: Types.ObjectId;
      cycle: Types.ObjectId;
      contribution: Types.ObjectId;
    },
    session: ClientSession,
    serviceFee: number = 0,
  ): Promise<boolean> {
    const reference = `contrib_${refs.contribution.toString()}`;

    // Idempotency check: query WITHOUT session so we can see documents
    // committed by other sessions. If a SUCCESS transaction with this
    // reference exists (from any session), this contribution has already
    // been processed.
    const successTx = await this.walletTxModel.findOne({
      reference,
      status: WalletTransactionStatus.SUCCESS,
    });

    if (successTx) {
      return true;
    }

    // Clean up any non-SUCCESS transactions with this reference from
    // previous failed attempts (also without session so we see all docs).
    await this.walletTxModel.deleteOne({
      reference,
      status: { $ne: WalletTransactionStatus.SUCCESS },
    });

    const wallet = await this.walletModel
      .findOne({ user: userId })
      .session(session);

    if (!wallet) {
      return false;
    }

    const balance = wallet.balance ?? 0;
    if (balance < amountNaira + serviceFee) {
      return false;
    }

    const balanceBefore = balance;
    const balanceAfter = balanceBefore - amountNaira - serviceFee;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const transactions = [
      {
        wallet: wallet._id,
        user: userId,
        type: WalletTransactionType.CONTRIBUTION_DEBIT,
        status: WalletTransactionStatus.SUCCESS,
        amount: amountNaira,
        balanceBefore,
        balanceAfter: balanceAfter + serviceFee,
        reference,
        group: refs.group,
        cycle: refs.cycle,
        contribution: refs.contribution,
      },
    ];

    if (serviceFee > 0) {
      transactions.push({
        wallet: wallet._id,
        user: userId,
        type: WalletTransactionType.SERVICE_FEE_DEBIT,
        status: WalletTransactionStatus.SUCCESS,
        amount: serviceFee,
        balanceBefore: balanceAfter + serviceFee,
        balanceAfter,
        reference: `${reference}_fee`,
        group: refs.group,
        cycle: refs.cycle,
        contribution: refs.contribution,
      });
    }

    try {
      await this.walletTxModel.create(transactions, { session, ordered: true });
    } catch (err) {
      // Race condition: another session created the same reference
      // between our idempotency check and this insert. Treat as success.
      if (this.isDuplicateKeyError(err)) {
        return true;
      }
      throw err;
    }

    return true;
  }

  // ---- Savings plan debits (used by SavingsService) -------------------------

  /**
   * Attempts to debit `amountNaira` from the member's wallet into an
   * individual savings plan. Mirrors `debitForContribution`: idempotent by
   * reference, session-transactional, returns `false` (no changes) if the
   * balance is insufficient.
   */
  async debitForSavings(
    userId: Types.ObjectId,
    amountNaira: number,
    refs: { savingPlan: Types.ObjectId },
    reference: string,
    session: ClientSession,
  ): Promise<boolean> {
    const successTx = await this.walletTxModel.findOne({
      reference,
      status: WalletTransactionStatus.SUCCESS,
    });

    if (successTx) {
      return true;
    }

    await this.walletTxModel.deleteOne({
      reference,
      status: { $ne: WalletTransactionStatus.SUCCESS },
    });

    const wallet = await this.walletModel
      .findOne({ user: userId })
      .session(session);

    if (!wallet) {
      return false;
    }

    const balance = wallet.balance ?? 0;
    if (balance < amountNaira) {
      return false;
    }

    const balanceBefore = balance;
    const balanceAfter = balanceBefore - amountNaira;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    try {
      await this.walletTxModel.create(
        [
          {
            wallet: wallet._id,
            user: userId,
            type: WalletTransactionType.SAVINGS_DEBIT,
            status: WalletTransactionStatus.SUCCESS,
            amount: amountNaira,
            balanceBefore,
            balanceAfter,
            reference,
            metadata: { savingPlan: refs.savingPlan.toString() },
          },
        ],
        { session, ordered: true },
      );
    } catch (err) {
      // Another session already recorded this reference.
      if (this.isDuplicateKeyError(err)) {
        return true;
      }
      throw err;
    }

    return true;
  }

  /**
   * Attempts to debit `amountNaira` (plus the platform's escrow-transfer
   * service charge) from the member's wallet to fund a pool donation (a
   * DonationGroup's escrow). Same contract as `debitForSavings`: idempotent
   * by `reference`, session-transactional, and returns `false` without
   * touching anything when the balance can't cover amount + fee.
   *
   * The Donation row is written first in the caller's transaction; its
   * unique reference — and this ledger's unique reference — mean a double
   * tap can only ever charge the wallet once.
   *
   * Two ledger entries are written: DONATION_DEBIT for the amount that
   * funds the pool's escrow, and (when `serviceFee` > 0) SERVICE_FEE_DEBIT
   * for the platform charge.
   */
  async debitForDonation(
    userId: Types.ObjectId,
    amountNaira: number,
    refs: { donationGroup: Types.ObjectId },
    reference: string,
    session: ClientSession,
    serviceFee = 0,
  ): Promise<boolean> {
    const successTx = await this.walletTxModel.findOne({
      reference,
      status: WalletTransactionStatus.SUCCESS,
    });

    if (successTx) {
      return true;
    }

    const fee = Math.max(serviceFee, 0);
    const feeReference = `${reference}_fee`;

    await this.walletTxModel.deleteOne({
      reference: { $in: fee > 0 ? [reference, feeReference] : [reference] },
      status: { $ne: WalletTransactionStatus.SUCCESS },
    });

    const wallet = await this.walletModel
      .findOne({ user: userId })
      .session(session);

    if (!wallet) {
      return false;
    }

    const balance = wallet.balance ?? 0;
    const total = amountNaira + fee;

    if (balance < total) {
      return false;
    }

    const balanceBefore = balance;
    // The donation itself leaves first, then the fee — so the
    // DONATION_DEBIT entry's balanceAfter is the balance the member saw
    // after funding the pool, with the fee line following it.
    const afterDonation = balanceBefore - amountNaira;
    const balanceAfter = afterDonation - fee;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const entries: Array<Record<string, unknown>> = [
      {
        wallet: wallet._id,
        user: userId,
        type: WalletTransactionType.DONATION_DEBIT,
        status: WalletTransactionStatus.SUCCESS,
        amount: amountNaira,
        balanceBefore,
        balanceAfter: afterDonation,
        reference,
        metadata: {
          donationGroup: refs.donationGroup.toString(),
          serviceFee: fee,
        },
      },
    ];

    if (fee > 0) {
      entries.push({
        wallet: wallet._id,
        user: userId,
        type: WalletTransactionType.SERVICE_FEE_DEBIT,
        status: WalletTransactionStatus.SUCCESS,
        amount: fee,
        balanceBefore: afterDonation,
        balanceAfter,
        reference: feeReference,
        metadata: {
          donationGroup: refs.donationGroup.toString(),
          source: 'donation_transfer_fee',
        },
      });
    }

    try {
      await this.walletTxModel.create(entries, { session, ordered: true });
    } catch (err) {
      // Another session already recorded this reference.
      if (this.isDuplicateKeyError(err)) {
        return true;
      }
      throw err;
    }

    return true;
  }

  /**
   * Credits the platform admin's wallet with a service fee collected from a
   * member — a contribution, a pool donation, or a payout. Creates a proper
   * WalletTransaction ledger entry with type SERVICE_FEE_CREDIT. Must be
   * called inside a session/transaction.
   *
   * Idempotent by `reference` (defaults to `sf_<contribution>`): the payout
   * webhook and the synchronous payout path can both land here, and the fee
   * must only ever be credited once.
   */
  async creditServiceFee(
    adminUserId: string,
    amount: number,
    refs: {
      group?: Types.ObjectId;
      cycle?: Types.ObjectId;
      contribution?: Types.ObjectId;
    },
    session: ClientSession,
    options: { reference?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    if (amount <= 0) return;

    const reference =
      options.reference ??
      (refs.contribution
        ? `sf_${refs.contribution.toString()}`
        : `sf_${new Types.ObjectId().toString()}`);

    const successTx = await this.walletTxModel.findOne({
      reference,
      status: WalletTransactionStatus.SUCCESS,
    });

    if (successTx) {
      return;
    }

    await this.walletTxModel.deleteOne({
      reference,
      status: { $ne: WalletTransactionStatus.SUCCESS },
    });

    const wallet = await this.walletModel
      .findOne({ user: new Types.ObjectId(adminUserId) })
      .session(session);

    if (!wallet) {
      return;
    }

    const balanceBefore = wallet.balance ?? 0;
    const balanceAfter = balanceBefore + amount;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user: new Types.ObjectId(adminUserId),
          type: WalletTransactionType.SERVICE_FEE_CREDIT,
          status: WalletTransactionStatus.SUCCESS,
          amount,
          balanceBefore,
          balanceAfter,
          reference,
          group: refs.group,
          cycle: refs.cycle,
          contribution: refs.contribution,
          metadata: options.metadata,
        },
      ],
      { session },
    );
  }

  // ---- Service fee debit/refund (used by CyclesService bank-transfer flow) ---

  /**
   * Debits ONLY the platform service fee from a member's wallet — used
   * when the member notifies the group admin of an inbound bank transfer
   * (the contribution itself settles in the group's escrow DVA, not in
   * the wallet). Idempotent by reference; must be called inside the
   * caller's transaction.
   *
   * Throws `BadRequestException` when the wallet can't cover the fee —
   * this aborts the caller's transaction so the contribution stays
   * PENDING and the member is told to fund their wallet first.
   */
  async debitServiceFee(
    userId: Types.ObjectId,
    amount: number,
    refs: {
      group: Types.ObjectId;
      cycle: Types.ObjectId;
      contribution: Types.ObjectId;
    },
    session: ClientSession,
  ): Promise<void> {
    if (amount <= 0) return;

    const reference = `fee_${refs.contribution.toString()}`;

    const successTx = await this.walletTxModel.findOne({
      reference,
      status: WalletTransactionStatus.SUCCESS,
    });

    if (successTx) {
      // Already charged (e.g. the member notified twice) — no-op.
      return;
    }

    await this.walletTxModel.deleteOne({
      reference,
      status: { $ne: WalletTransactionStatus.SUCCESS },
    });

    const wallet = await this.walletModel
      .findOne({ user: userId })
      .session(session);

    const balance = wallet?.balance ?? 0;

    if (!wallet || balance < amount) {
      throw new BadRequestException(
        `Your wallet balance (₦${balance.toLocaleString()}) can't cover the ₦${amount.toLocaleString()} service fee. Please fund your wallet and try again.`,
      );
    }

    const balanceBefore = balance;
    const balanceAfter = balanceBefore - amount;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user: userId,
          type: WalletTransactionType.SERVICE_FEE_DEBIT,
          status: WalletTransactionStatus.SUCCESS,
          amount,
          balanceBefore,
          balanceAfter,
          reference,
          group: refs.group,
          cycle: refs.cycle,
          contribution: refs.contribution,
        },
      ],
      { session },
    );
  }

  /**
   * Returns a previously-debited service fee to the member's wallet when
   * the group admin rejects a claimed bank-transfer contribution
   * (SERVICE_FEE_REFUND). Idempotent by reference; must be called inside
   * the caller's transaction.
   */
  async refundServiceFee(
    userId: Types.ObjectId,
    amount: number,
    refs: {
      group: Types.ObjectId;
      cycle: Types.ObjectId;
      contribution: Types.ObjectId;
    },
    session: ClientSession,
  ): Promise<void> {
    if (amount <= 0) return;

    const reference = `fee_refund_${refs.contribution.toString()}`;

    const successTx = await this.walletTxModel.findOne({
      reference,
      status: WalletTransactionStatus.SUCCESS,
    });

    if (successTx) {
      return;
    }

    await this.walletTxModel.deleteOne({
      reference,
      status: { $ne: WalletTransactionStatus.SUCCESS },
    });

    const wallet = await this.walletModel
      .findOne({ user: userId })
      .session(session);

    if (!wallet) return;

    const balanceBefore = wallet.balance ?? 0;
    const balanceAfter = balanceBefore + amount;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user: userId,
          type: WalletTransactionType.SERVICE_FEE_REFUND,
          status: WalletTransactionStatus.SUCCESS,
          amount,
          balanceBefore,
          balanceAfter,
          reference,
          group: refs.group,
          cycle: refs.cycle,
          contribution: refs.contribution,
        },
      ],
      { session },
    );
  }

  /**
   * Reverses a SERVICE_FEE_CREDIT (writes a SERVICE_FEE_DEBIT on the admin
   * wallet). Used when a rejected bank-transfer contribution refunds the
   * fee to the member, and when a payout that already paid its fee is
   * reversed by the bank.
   *
   * Best-effort: if the admin wallet no longer holds the fee (already
   * withdrawn), the reversal is skipped and logged rather than blocking
   * the member's refund — the member's money always comes back.
   */
  async reverseServiceFeeCredit(
    adminUserId: string,
    amount: number,
    refs: {
      group?: Types.ObjectId;
      cycle?: Types.ObjectId;
      contribution?: Types.ObjectId;
    },
    session: ClientSession,
    options: { reference?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    if (amount <= 0) return;

    const reference =
      options.reference ??
      (refs.contribution
        ? `sf_reversal_${refs.contribution.toString()}`
        : `sf_reversal_${new Types.ObjectId().toString()}`);

    const successTx = await this.walletTxModel.findOne({
      reference,
      status: WalletTransactionStatus.SUCCESS,
    });

    if (successTx) return;

    await this.walletTxModel.deleteOne({
      reference,
      status: { $ne: WalletTransactionStatus.SUCCESS },
    });

    const wallet = await this.walletModel
      .findOne({ user: new Types.ObjectId(adminUserId) })
      .session(session);

    const balance = wallet?.balance ?? 0;

    if (!wallet || balance < amount) {
      return;
    }

    const balanceBefore = balance;
    const balanceAfter = balanceBefore - amount;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user: new Types.ObjectId(adminUserId),
          type: WalletTransactionType.SERVICE_FEE_DEBIT,
          status: WalletTransactionStatus.SUCCESS,
          amount,
          balanceBefore,
          balanceAfter,
          reference,
          group: refs.group,
          cycle: refs.cycle,
          contribution: refs.contribution,
          metadata: options.metadata,
        },
      ],
      { session },
    );
  }

  // ---- Bill commission credit (used by BillsService) -------------------------

  /**
   * Credits the platform admin's wallet with the commission earned from a
   * bill payment (the difference between what the user paid and what VTPass
   * actually charged). Creates a WalletTransaction with type
   * BILL_COMMISSION_CREDIT. Must be called inside a session/transaction.
   */
  async creditBillCommission(
    adminUserId: string,
    commissionAmount: number,
    refs: {
      billReference: string;
      billType: string;
      userPaid: number;
      actualCost: number;
    },
    session: ClientSession,
  ): Promise<void> {
    const wallet = await this.walletModel
      .findOne({ user: new Types.ObjectId(adminUserId) })
      .session(session);

    if (!wallet) {
      return;
    }

    const balanceBefore = wallet.balance ?? 0;
    const balanceAfter = balanceBefore + commissionAmount;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const reference = `bill_comm_${refs.billReference}`;

    await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user: new Types.ObjectId(adminUserId),
          type: WalletTransactionType.BILL_COMMISSION_CREDIT,
          status: WalletTransactionStatus.SUCCESS,
          amount: commissionAmount,
          balanceBefore,
          balanceAfter,
          reference,
          metadata: {
            billReference: refs.billReference,
            billType: refs.billType,
            userPaid: refs.userPaid,
            actualCost: refs.actualCost,
          },
        },
      ],
      { session },
    );
  }

  // ---- Bill payment debits (used by BillsService) ---------------------------

  /**
   * Debits `amountNaira` from the member's wallet for a bill payment.
   * Returns the created WalletTransaction document, or null if balance
   * is insufficient. The caller is responsible for calling
   * `confirmBillPayment` or `failBillPayment` once the external provider
   * responds.
   */
  /**
   * Debits a bill purchase from the wallet the member chose to pay from.
   *
   * `options.source` is `main` by default; `cashback` spends the cashback
   * balance instead (the app's "Pay from: Cashback" option). Returns `null`
   * when the chosen balance can't cover the amount, so the caller can answer
   * "Insufficient balance" without having moved any money.
   */
  async debitForBillPayment(
    userId: Types.ObjectId,
    amountNaira: number,
    reference: string,
    metadata: Record<string, unknown>,
    session: ClientSession,
    options: { source?: BillPaymentSource } = {},
  ): Promise<WalletTransactionDocument | null> {
    const source: BillPaymentSource =
      options.source === 'cashback' ? 'cashback' : 'main';

    const wallet = await this.walletModel
      .findOne({ user: userId })
      .session(session);

    if (!wallet) {
      return null;
    }

    const balance =
      source === 'cashback'
        ? (wallet.cashbackBalance ?? 0)
        : (wallet.balance ?? 0);
    if (balance < amountNaira) {
      return null;
    }

    const balanceBefore = balance;
    const balanceAfter = roundNaira(balanceBefore - amountNaira);

    if (source === 'cashback') {
      wallet.cashbackBalance = balanceAfter;
    } else {
      wallet.balance = balanceAfter;
    }
    await wallet.save({ session });

    const walletTx = await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user: userId,
          type:
            source === 'cashback'
              ? WalletTransactionType.CASHBACK_DEBIT
              : WalletTransactionType.BILL_PAYMENT,
          status: WalletTransactionStatus.PENDING,
          amount: amountNaira,
          balanceBefore,
          balanceAfter,
          reference,
          // `walletSource` lets the failure path refund the same balance the
          // debit came out of, and keeps the ledger self-describing.
          metadata: { ...metadata, walletSource: source },
        },
      ],
      { session },
    );

    return walletTx[0];
  }

  /**
   * Confirms a pending bill debit (successful external call). Handles both
   * `BILL_PAYMENT` (main wallet) and `CASHBACK_DEBIT` (cashback wallet)
   * entries. Must run inside the same session as `debitForBillPayment` so the
   * in-transaction (uncommitted) PENDING record is visible and the SUCCESS
   * status persists on commit.
   */
  async confirmBillPayment(
    reference: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.walletTxModel.updateOne(
      {
        reference,
        status: WalletTransactionStatus.PENDING,
        type: {
          $in: [
            WalletTransactionType.BILL_PAYMENT,
            WalletTransactionType.CASHBACK_DEBIT,
          ],
        },
      },
      { $set: { status: WalletTransactionStatus.SUCCESS } },
      session ? { session } : undefined,
    );
  }

  /**
   * Marks a pending bill debit as FAILED and refunds the balance it came from
   * (main wallet or cashback — see the entry's type).
   */
  async failBillPayment(
    reference: string,
    amountNaira: number,
    session: ClientSession,
  ): Promise<void> {
    const tx = await this.walletTxModel
      .findOne({
        reference,
        status: WalletTransactionStatus.PENDING,
        type: {
          $in: [
            WalletTransactionType.BILL_PAYMENT,
            WalletTransactionType.CASHBACK_DEBIT,
          ],
        },
      })
      .session(session);

    if (!tx) return;

    const wallet = await this.walletModel.findById(tx.wallet).session(session);

    if (!wallet) return;

    const refundToCashback = tx.type === WalletTransactionType.CASHBACK_DEBIT;

    const balanceBefore = refundToCashback
      ? (wallet.cashbackBalance ?? 0)
      : (wallet.balance ?? 0);
    const balanceAfter = roundNaira(balanceBefore + amountNaira);

    if (refundToCashback) {
      wallet.cashbackBalance = balanceAfter;
    } else {
      wallet.balance = balanceAfter;
    }
    await wallet.save({ session });

    tx.status = WalletTransactionStatus.FAILED;
    await tx.save({ session });

    // A cashback refund must not read like a wallet top-up, so only the main
    // wallet's refund announces a new balance.
    if (refundToCashback) return;

    const notifyUserId = tx.user.toString();
    const notifyNewBalance = balanceAfter;

    if (notifyUserId && notifyNewBalance !== undefined) {
      void this.notificationsService.send(
        NotificationEvents.walletFunded({
          userIds: [notifyUserId],
          amount: amountNaira,
          newBalance: notifyNewBalance,
        }),
      );
    }
  }

  /**
   * Credits cashback earned on a successful bill purchase to the member's
   * cashback balance, recording a CASHBACK_CREDIT ledger entry.
   *
   * Called inside the purchase transaction *after* the external vend was
   * confirmed, so a failed purchase never earns cashback. Idempotent by
   * `cb_<bill reference>`: a retried call moves nothing twice.
   */
  async creditBillCashback(
    userId: string,
    amountNaira: number,
    refs: {
      billReference: string;
      billType: string;
      /** Rate the cashback was computed from, kept for auditing. */
      cashbackPercent: number;
      purchaseAmount: number;
    },
    session: ClientSession,
  ): Promise<void> {
    if (amountNaira <= 0) return;

    const reference = `cb_${refs.billReference}`;

    const alreadyCredited = await this.walletTxModel
      .findOne({ reference, status: WalletTransactionStatus.SUCCESS })
      .session(session);
    if (alreadyCredited) return;

    const user = new Types.ObjectId(userId);

    const wallet = await this.walletModel.findOne({ user }).session(session);
    if (!wallet) return;

    const balanceBefore = wallet.cashbackBalance ?? 0;
    const balanceAfter = roundNaira(balanceBefore + amountNaira);

    wallet.cashbackBalance = balanceAfter;
    await wallet.save({ session });

    await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user,
          type: WalletTransactionType.CASHBACK_CREDIT,
          status: WalletTransactionStatus.SUCCESS,
          amount: amountNaira,
          balanceBefore,
          balanceAfter,
          reference,
          metadata: {
            billReference: refs.billReference,
            billType: refs.billType,
            cashbackPercent: refs.cashbackPercent,
            purchaseAmount: refs.purchaseAmount,
          },
        },
      ],
      { session },
    );
  }

  /**
   * Platform-admin-only. Credits `amountNaira` to a user's wallet and records
   * an ADMIN_CREDIT ledger entry. Unlike FUNDING, this is an immediate,
   * synchronous internal movement — the balance is updated and the entry is
   * created as SUCCESS in one go (no Paystack involved).
   */
  async creditUserWallet(
    userId: string,
    amountNaira: number,
    note?: string,
  ): Promise<{ balance: number; currency: string }> {
    if (amountNaira <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const wallet = await this.getOrCreateWallet(userId);

    const balanceBefore = wallet.balance ?? 0;
    const balanceAfter = balanceBefore + amountNaira;

    wallet.balance = balanceAfter;
    await wallet.save();

    const reference = `admin_credit_${randomUUID()}`;

    await this.walletTxModel.create([
      {
        wallet: wallet._id,
        user: wallet.user,
        type: WalletTransactionType.ADMIN_CREDIT,
        status: WalletTransactionStatus.SUCCESS,
        amount: amountNaira,
        balanceBefore,
        balanceAfter,
        reference,
        metadata: { note: note?.trim() || 'Admin wallet credit' },
      },
    ]);

    return { balance: balanceAfter, currency: wallet.currency };
  }
}
