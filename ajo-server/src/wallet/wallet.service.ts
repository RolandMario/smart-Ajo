import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
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

export interface PaginatedWalletTransactions {
  transactions: WalletTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class WalletService {
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
   * Returns the member's Paystack Dedicated Virtual Account, creating it
   * lazily on first use (mirrors `getOrCreateWallet`) and storing it on
   * the user. The account number is assigned by Paystack — the member's
   * verified phone is passed to Paystack and used to reconcile inbound
   * transfers via the `charge.success` webhook.
   */
  async getOrCreateDedicatedAccount(userId: string): Promise<DedicatedAccount> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phone) {
      throw new BadRequestException(
        'A verified phone number is required before a dedicated account can be created',
      );
    }

    const stored = user.dedicatedAccount;

    if (stored?.active && stored.accountNumber) {
      return stored;
    }

    // 1. Ensure the Paystack customer exists (reuse the stored code).
    const customerCode =
      stored?.paystackCustomerCode ?? (await this.createPaystackCustomer(user));

    // Persist the customer code immediately so a later failure can be
    // retried without creating a duplicate Paystack customer.
    if (customerCode !== stored?.paystackCustomerCode) {
      user.dedicatedAccount = {
        paystackCustomerCode: customerCode,
        provider: 'paystack',
        currency: 'NGN',
        active: false,
      };
      await user.save();
    }

    // 2. Request the virtual account.
    const { firstName, lastName } = this.splitName(user.name);
    let result: DedicatedAccountResult;

    try {
      result = await this.paystack.createDedicatedAccount({
        customerCode,
        preferredBank: this.paystack.dvaPreferredBank(),
        phone: user.phone,
        firstName,
        lastName,
      });
    } catch (err) {
      // The customer may already have a DVA (e.g. a previous attempt
      // succeeded on Paystack's side but failed to persist). Recover the
      // existing assignment instead of erroring out.
      const existing = await this.paystack.fetchDedicatedAccounts(customerCode);
      result = existing.find((dva) => dva.active) ?? existing[0];

      if (!result?.accountNumber) {
        throw err;
      }
    }

    const dedicatedAccount: DedicatedAccount = {
      paystackCustomerCode: customerCode,
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
   * Returns `true` when a credit was applied, `false` if the user is
   * unknown or the reference was already processed.
   */
  async creditDedicatedAccountFunding(params: {
    phone: string;
    amountNaira: number;
    reference: string;
    paystackData?: Record<string, unknown>;
  }): Promise<boolean> {
    const user = await this.usersService.findByPhone(params.phone);

    if (!user) {
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

  private async createPaystackCustomer(user: {
    phone: string;
    email?: string;
    name?: string;
  }): Promise<string> {
    const { firstName, lastName } = this.splitName(user.name);
    const { customerCode } = await this.paystack.createCustomer({
      firstName,
      lastName,
      phone: user.phone,
      email: user.email,
    });
    return customerCode;
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
    } catch (err: any) {
      // Race condition: another session created the same reference
      // between our idempotency check and this insert. Treat as success.
      const code = err?.code ?? err?.err?.code;
      const message = String(err?.message ?? err);
      const isDuplicateKey =
        code === 11000 || code === '11000' || message.includes('E11000');
      if (isDuplicateKey) {
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
    } catch (err: any) {
      const code = err?.code ?? err?.err?.code;
      const message = String(err?.message ?? err);
      const isDuplicateKey =
        code === 11000 || code === '11000' || message.includes('E11000');
      if (isDuplicateKey) {
        return true;
      }
      throw err;
    }

    return true;
  }

  /**
   * Credits the platform admin's wallet with a service fee collected from
   * a member's contribution. Creates a proper WalletTransaction ledger
   * entry with type SERVICE_FEE_CREDIT. Must be called inside a session/
   * transaction.
   */
  async creditServiceFee(
    adminUserId: string,
    amount: number,
    refs: {
      group: Types.ObjectId;
      cycle: Types.ObjectId;
      contribution: Types.ObjectId;
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
    const balanceAfter = balanceBefore + amount;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const reference = `sf_${refs.contribution.toString()}`;

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
  async debitForBillPayment(
    userId: Types.ObjectId,
    amountNaira: number,
    reference: string,
    metadata: Record<string, unknown>,
    session: ClientSession,
  ): Promise<WalletTransactionDocument | null> {
    const wallet = await this.walletModel
      .findOne({ user: userId })
      .session(session);

    if (!wallet) {
      return null;
    }

    const balance = wallet.balance ?? 0;
    if (balance < amountNaira) {
      return null;
    }

    const balanceBefore = balance;
    const balanceAfter = balanceBefore - amountNaira;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const walletTx = await this.walletTxModel.create(
      [
        {
          wallet: wallet._id,
          user: userId,
          type: WalletTransactionType.BILL_PAYMENT,
          status: WalletTransactionStatus.PENDING,
          amount: amountNaira,
          balanceBefore,
          balanceAfter,
          reference,
          metadata,
        },
      ],
      { session },
    );

    return walletTx[0];
  }

  /**
   * Confirms a pending BILL_PAYMENT transaction (successful external call).
   * Must run inside the same session as `debitForBillPayment` so the in-transaction
   * (uncommitted) PENDING record is visible and the SUCCESS status persists on commit.
   */
  async confirmBillPayment(
    reference: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.walletTxModel.updateOne(
      {
        reference,
        status: WalletTransactionStatus.PENDING,
        type: WalletTransactionType.BILL_PAYMENT,
      },
      { $set: { status: WalletTransactionStatus.SUCCESS } },
      session ? { session } : undefined,
    );
  }

  /**
   * Marks a pending BILL_PAYMENT as FAILED and refunds the wallet.
   */
  async failBillPayment(
    reference: string,
    amountNaira: number,
    session: ClientSession,
  ): Promise<void> {
    const tx = await this.walletTxModel
      .findOne({ reference, status: WalletTransactionStatus.PENDING })
      .session(session);

    if (!tx) return;

    const wallet = await this.walletModel.findById(tx.wallet).session(session);

    if (!wallet) return;

    const balanceBefore = wallet.balance ?? 0;
    const balanceAfter = balanceBefore + amountNaira;
    wallet.balance = balanceAfter;
    await wallet.save({ session });

    tx.status = WalletTransactionStatus.FAILED;
    await tx.save({ session });

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
