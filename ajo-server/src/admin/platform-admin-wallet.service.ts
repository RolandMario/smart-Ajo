import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { WalletService } from '../wallet/wallet.service';
import { UsersService } from '../users/users.service';
import { PaystackService } from '../payments/paystack.service';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from '../wallet/schemas/wallet-transaction.schema';
import {
  WalletTransactionStatus,
  WalletTransactionType,
} from '../common/enums/wallet.enum';
import { SetBankAccountDto } from '../wallet/dto/set-bank-account.dto';
import { BankAccount } from '../users/schemas/bank-account.schema';
import { randomUUID } from 'crypto';

export interface AdminWalletSummary {
  balance: number;
  currency: string;
  bankAccount: BankAccount | null;
  totalCommissionBalance: number;
  recentServiceFeeCredits: Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    group?: { id: string; name: string };
    createdAt: Date;
  }>;
  recentBillCommissionCredits: Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    billType: string;
    userPaid: number;
    actualCost: number;
    createdAt: Date;
  }>;
}

@Injectable()
export class PlatformAdminWalletService {
  constructor(
    @InjectModel(WalletTransaction.name)
    private walletTxModel: Model<WalletTransactionDocument>,
    @InjectConnection() private connection: Connection,
    private walletService: WalletService,
    private usersService: UsersService,
    private paystack: PaystackService,
  ) {}

  /**
   * Returns the platform admin's wallet summary: current balance, bank
   * account, and recent service fee credit transactions.
   */
  async getAdminWallet(): Promise<AdminWalletSummary> {
    const admin = await this.usersService.findPlatformAdmin();
    const wallet = await this.walletService.getOrCreateWallet(
      admin._id.toString(),
    );

    const recentServiceFeeCredits = await this.walletTxModel
      .find({
        user: admin._id,
        type: WalletTransactionType.SERVICE_FEE_CREDIT,
        status: WalletTransactionStatus.SUCCESS,
      })
      .populate('group', 'name')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const recentBillCommissionCredits = await this.walletTxModel
      .find({
        user: admin._id,
        type: WalletTransactionType.BILL_COMMISSION_CREDIT,
        status: WalletTransactionStatus.SUCCESS,
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Calculate total commission balance (sum of all bill commission credits)
    const totalCommissionResult = await this.walletTxModel.aggregate([
      {
        $match: {
          user: admin._id,
          type: WalletTransactionType.BILL_COMMISSION_CREDIT,
          status: WalletTransactionStatus.SUCCESS,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totalCommissionBalance = totalCommissionResult.length > 0 ? totalCommissionResult[0].total : 0;

    return {
      balance: wallet.balance ?? 0,
      currency: wallet.currency,
      bankAccount: admin.bankAccount ?? null,
      totalCommissionBalance,
      recentServiceFeeCredits: recentServiceFeeCredits.map((tx) => {
        const group = tx.group as unknown as
          | { _id: { toString(): string }; name: string }
          | undefined;
        return {
          id: tx._id.toString(),
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          group: group
            ? { id: group._id.toString(), name: group.name }
            : undefined,
          createdAt: (tx as unknown as { createdAt: Date }).createdAt,
        };
      }),
      recentBillCommissionCredits: recentBillCommissionCredits.map((tx) => {
        const metadata = (tx.metadata ?? {}) as {
          billType?: string;
          userPaid?: number;
          actualCost?: number;
        };
        return {
          id: tx._id.toString(),
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          billType: metadata.billType ?? 'unknown',
          userPaid: metadata.userPaid ?? 0,
          actualCost: metadata.actualCost ?? 0,
          createdAt: (tx as unknown as { createdAt: Date }).createdAt,
        };
      }),
    };
  }

  /**
   * Withdraws `amountNaira` from the admin wallet to the admin's
   * registered bank account via Paystack transfer.
   */
  async withdraw(adminUserId: string, amountNaira: number) {
    const admin = await this.usersService.findById(adminUserId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (!admin.bankAccount?.paystackRecipientCode) {
      throw new BadRequestException(
        'You must set a bank account before withdrawing. Use POST /admin/wallet/bank-account first.',
      );
    }

    const wallet = await this.walletService.getOrCreateWallet(adminUserId);
    if ((wallet.balance ?? 0) < amountNaira) {
      throw new BadRequestException(
        `Insufficient balance. You have ${wallet.balance ?? 0} but trying to withdraw ${amountNaira}.`,
      );
    }

    const reference = `admin_withdraw_${randomUUID()}`;

    // Debit wallet inside a transaction
    const session = await this.connection.startSession();
    let debited = false;

    try {
      await session.withTransaction(async () => {
        const balanceBefore = wallet.balance ?? 0;
        const balanceAfter = balanceBefore - amountNaira;

        wallet.balance = balanceAfter;
        await wallet.save({ session });

        await this.walletTxModel.create(
          [
            {
              wallet: wallet._id,
              user: admin._id,
              type: WalletTransactionType.ADMIN_WITHDRAWAL,
              status: WalletTransactionStatus.PENDING,
              amount: amountNaira,
              balanceBefore,
              balanceAfter,
              reference,
              metadata: { source: 'admin_withdrawal' },
            },
          ],
          { session },
        );

        debited = true;
      });
    } finally {
      await session.endSession();
    }

    if (!debited) {
      throw new BadRequestException('Could not debit the wallet');
    }

    // Initiate the Paystack transfer OUTSIDE the transaction.
    // If the transfer fails, we mark the wallet transaction as FAILED.
    try {
      const transfer = await this.paystack.initiateTransfer({
        amountNaira,
        recipientCode: admin.bankAccount.paystackRecipientCode,
        reason: 'Ajo admin wallet withdrawal',
        reference,
      });

      // Mark the wallet transaction as SUCCESS since the transfer was initiated
      await this.walletTxModel.updateOne(
        { reference, status: WalletTransactionStatus.PENDING },
        { $set: { status: WalletTransactionStatus.SUCCESS } },
      );

      return {
        message: 'Withdrawal initiated successfully',
        amount: amountNaira,
        transferCode: transfer.transferCode,
        status: transfer.status,
      };
    } catch (err) {
      // Transfer failed — refund the wallet
      const refundSession = await this.connection.startSession();
      try {
        await refundSession.withTransaction(async () => {
          const w = await this.walletService
            .getOrCreateWallet(adminUserId);

          w.balance = (w.balance ?? 0) + amountNaira;
          await w.save({ session: refundSession });

          // Mark the tx as FAILED and record the refund in balance
          await this.walletTxModel.updateOne(
            { reference, status: WalletTransactionStatus.PENDING },
            {
              $set: {
                status: WalletTransactionStatus.FAILED,
                metadata: { error: String(err), refunded: true },
              },
            },
            { session: refundSession },
          );
        });
      } finally {
        await refundSession.endSession();
      }

      throw new BadRequestException(
        `Withdrawal failed: the transfer could not be initiated. Your wallet has been refunded.`,
      );
    }
  }

  /**
   * Gets the admin's bank account for withdrawals.
   */
  async getBankAccount(adminUserId: string): Promise<BankAccount | null> {
    return this.walletService.getBankAccount(adminUserId);
  }

  /**
   * Sets the admin's bank account for withdrawals.
   */
  async setBankAccount(
    adminUserId: string,
    dto: SetBankAccountDto,
  ): Promise<BankAccount> {
    return this.walletService.setBankAccount(adminUserId, dto);
  }

  /**
   * Lists Nigerian banks for the bank account setup form.
   */
  async listBanks() {
    return this.walletService.listBanks();
  }
}