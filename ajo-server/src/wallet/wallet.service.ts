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
import { PaystackService, BankListEntry } from '../payments/paystack.service';
import { BankAccount } from '../users/schemas/bank-account.schema';
import { SetBankAccountDto } from './dto/set-bank-account.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';

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
      wallet = await this.walletModel.create({ user: userObjectId, balance: 0 });
    }

    return wallet;
  }

  async getWalletSummary(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    const recentTransactions = await this.walletTxModel
      .find({ user: wallet.user })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      balance: wallet.balance ?? 0,
      currency: wallet.currency,
      recentTransactions,
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
   */
  async confirmFunding(
    reference: string,
    amountNaira: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const session = await this.connection.startSession();

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
  }

  async failFunding(reference: string): Promise<void> {
    await this.walletTxModel.updateOne(
      { reference, status: WalletTransactionStatus.PENDING },
      { $set: { status: WalletTransactionStatus.FAILED } },
    );
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

  // ---- Service fee credit (used by CyclesService) ---------------------------

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
      { reference, status: WalletTransactionStatus.PENDING, type: WalletTransactionType.BILL_PAYMENT },
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

    const wallet = await this.walletModel
      .findById(tx.wallet)
      .session(session);

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
