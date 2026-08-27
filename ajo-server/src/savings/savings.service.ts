import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Connection, Model, Types } from 'mongoose';
import { SavingPlan, SavingPlanDocument } from './schemas/saving-plan.schema';
import {
  SavingTransaction,
  SavingTransactionDocument,
} from './schemas/saving-transaction.schema';
import {
  SavingDurationUnit,
  SavingPlanStatus,
  SavingTransactionType,
} from '../common/enums/saving.enum';
import { ContributionFrequency } from '../common/enums/group.enum';
import { WalletService } from '../wallet/wallet.service';
import { PaystackService } from '../payments/paystack.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';
import { CreateSavingPlanDto } from './dto/create-saving-plan.dto';

/** Maximum allowed duration per unit (keeps interval counts sane). */
const DURATION_LIMITS: Record<SavingDurationUnit, number> = {
  [SavingDurationUnit.DAYS]: 365,
  [SavingDurationUnit.MONTHS]: 120,
  [SavingDurationUnit.YEARS]: 10,
};

const FREQUENCY_LABEL: Record<ContributionFrequency, string> = {
  [ContributionFrequency.DAILY]: 'daily',
  [ContributionFrequency.WEEKLY]: 'weekly',
  [ContributionFrequency.MONTHLY]: 'monthly',
};

@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);

  constructor(
    @InjectModel(SavingPlan.name)
    private savingPlanModel: Model<SavingPlanDocument>,
    @InjectModel(SavingTransaction.name)
    private savingTxModel: Model<SavingTransactionDocument>,
    @InjectConnection() private connection: Connection,
    private walletService: WalletService,
    private paystack: PaystackService,
    private usersService: UsersService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // ---- Helpers --------------------------------------------------------------

  /**
   * Derives the cycle length for a plan from (frequency, durationUnit,
   * durationValue). The duration is measured from `startAt` (the day the plan
   * is created) — e.g. daily + 20 days => 20 intervals, monthly + 2 months =>
   * 2 intervals, weekly + 20 days => 3 intervals. `intervalCount` is the
   * number of interval boundaries inside [startAt, endAt), computed with the
   * same `nextDue` step the scheduler uses so they always agree.
   */
  private computeCycle(
    startAt: Date,
    frequency: ContributionFrequency,
    durationUnit: SavingDurationUnit,
    durationValue: number,
  ): { intervalCount: number; endAt: Date } {
    const limit = DURATION_LIMITS[durationUnit];
    if (durationValue > limit) {
      throw new BadRequestException(
        `Duration is too long. Maximum is ${limit} ${durationUnit}.`,
      );
    }
    const endAt = this.addDuration(startAt, durationUnit, durationValue);
    let intervalCount = 0;
    let cursor = new Date(startAt);
    while (cursor.getTime() < endAt.getTime()) {
      intervalCount += 1;
      cursor = this.nextDue(cursor, frequency);
    }
    return { intervalCount, endAt };
  }

  /** Advances a date by the given calendar duration. */
  private addDuration(
    from: Date,
    unit: SavingDurationUnit,
    value: number,
  ): Date {
    const d = new Date(from);
    switch (unit) {
      case SavingDurationUnit.DAYS:
        d.setDate(d.getDate() + value);
        break;
      case SavingDurationUnit.MONTHS:
        d.setMonth(d.getMonth() + value);
        break;
      case SavingDurationUnit.YEARS:
        d.setFullYear(d.getFullYear() + value);
        break;
    }
    return d;
  }

  /** Advances a date by one interval of the given frequency. */
  private nextDue(from: Date, frequency: ContributionFrequency): Date {
    const d = new Date(from);
    switch (frequency) {
      case ContributionFrequency.DAILY:
        d.setDate(d.getDate() + 1);
        break;
      case ContributionFrequency.WEEKLY:
        d.setDate(d.getDate() + 7);
        break;
      case ContributionFrequency.MONTHLY:
        d.setMonth(d.getMonth() + 1);
        break;
    }
    return d;
  }

  private async requireOwnPlan(
    userId: string,
    planId: string,
  ): Promise<SavingPlanDocument> {
    const plan = await this.savingPlanModel.findOne({
      _id: new Types.ObjectId(planId),
      user: new Types.ObjectId(userId),
    });
    if (!plan) {
      throw new NotFoundException('Savings plan not found');
    }
    return plan;
  }

  // ---- Creation / read ------------------------------------------------------

  async createPlan(userId: string, dto: CreateSavingPlanDto) {
    const now = new Date();
    const { intervalCount, endAt } = this.computeCycle(
      now,
      dto.frequency,
      dto.durationUnit,
      dto.durationValue,
    );

    const plan = await this.savingPlanModel.create({
      user: new Types.ObjectId(userId),
      name: dto.name.trim(),
      amount: dto.amount,
      frequency: dto.frequency,
      durationUnit: dto.durationUnit,
      durationValue: dto.durationValue,
      intervalCount,
      cycleNumber: 1,
      collectedCount: 0,
      savingsBalance: 0,
      lifetimeSaved: 0,
      status: SavingPlanStatus.ACTIVE,
      // Set due in the past so the scheduler collects the first interval promptly.
      nextDueAt: now,
      startAt: now,
      endAt,
    });

    const user = await this.usersService.findById(userId);
    const phone = user?.phone;
    void this.notificationsService.send(
      NotificationEvents.savingCreated({
        userIds: [userId],
        planName: plan.name,
        amount: plan.amount,
        frequency: FREQUENCY_LABEL[plan.frequency],
        phones: phone ? new Map([[userId, phone]]) : undefined,
      }),
    );

    return this.getPlan(userId, plan._id.toString());
  }

  async listPlans(userId: string) {
    const plans = await this.savingPlanModel
      .find({
        user: new Types.ObjectId(userId),
        status: { $ne: SavingPlanStatus.DELETED },
      })
      .sort({ createdAt: -1 })
      .lean();

    return plans;
  }

  async getPlan(userId: string, planId: string) {
    const plan = await this.requireOwnPlan(userId, planId);

    const transactions = await this.savingTxModel
      .find({ plan: plan._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return { plan, transactions };
  }

  // ---- Auto-collection (scheduler) ------------------------------------------

  /**
   * Finds every active plan whose next due moment has passed and tries to
   * auto-debit the wallet. Called by the cron scheduler. Handles the
   * catch-up case (e.g. server was offline across several intervals) by
   * collecting multiple due intervals in sequence.
   */
  async processDuePlans(): Promise<void> {
    const now = new Date();
    const duePlans = await this.savingPlanModel.find({
      status: SavingPlanStatus.ACTIVE,
      nextDueAt: { $lte: now },
    });

    for (const plan of duePlans) {
      try {
        await this.processPlan(plan);
      } catch (err) {
        this.logger.error(
          `Failed to process savings plan ${plan._id.toString()}: ${String(err)}`,
        );
      }
    }
  }

  private async processPlan(plan: SavingPlanDocument): Promise<void> {
    const userId = plan.user.toString();

    while (
      plan.status === SavingPlanStatus.ACTIVE &&
      plan.nextDueAt <= new Date() &&
      plan.collectedCount < plan.intervalCount
    ) {
      const sequence = plan.collectedCount;
      const reference = `saving_${plan._id.toString()}_${plan.cycleNumber}_${sequence}`;

      const session = await this.connection.startSession();
      let debited = false;
      try {
        await session.withTransaction(async () => {
          debited = await this.walletService.debitForSavings(
            plan.user,
            plan.amount,
            { savingPlan: plan._id },
            reference,
            session,
          );

          if (debited) {
            await this.savingTxModel.create(
              [
                {
                  plan: plan._id,
                  user: plan.user,
                  type: SavingTransactionType.SAVING_DEBIT,
                  amount: plan.amount,
                  reference,
                  cycleNumber: plan.cycleNumber,
                },
              ],
              { session },
            );

            plan.collectedCount += 1;
            plan.savingsBalance += plan.amount;
            plan.lifetimeSaved += plan.amount;
            plan.nextDueAt = this.nextDue(plan.nextDueAt, plan.frequency);
            await plan.save({ session });
          }
        });
      } finally {
        await session.endSession();
      }

      if (!debited) {
        await this.notifyInsufficient(plan);
        return;
      }

      void this.notificationsService.send(
        NotificationEvents.savingDebited({
          userIds: [userId],
          planName: plan.name,
          amount: plan.amount,
          newBalance: plan.savingsBalance,
        }),
      );
    }

    // Cycle finished — mark complete so Withdraw becomes available.
    if (plan.collectedCount >= plan.intervalCount) {
      plan.status = SavingPlanStatus.COMPLETED;
      plan.endAt = new Date();
      await plan.save();

      void this.notificationsService.send(
        NotificationEvents.savingCompleted({
          userIds: [userId],
          planName: plan.name,
          total: plan.savingsBalance,
        }),
      );
    }
  }

  private async notifyInsufficient(plan: SavingPlanDocument): Promise<void> {
    const now = new Date();
    const last = plan.lastInsufficientNotifiedAt;
    if (last && now.getTime() - last.getTime() < 6 * 60 * 60 * 1000) {
      return; // Throttle to avoid notification spam every scheduler run.
    }

    plan.lastInsufficientNotifiedAt = now;
    await plan.save();

    const userId = plan.user.toString();
    const user = await this.usersService.findById(userId);
    const wallet = await this.walletService.getOrCreateWallet(userId);

    void this.notificationsService.send(
      NotificationEvents.savingInsufficient({
        userIds: [userId],
        planName: plan.name,
        amount: plan.amount,
        currentBalance: wallet.balance ?? 0,
        phones: user?.phone ? new Map([[userId, user.phone]]) : undefined,
      }),
    );
  }

  // ---- Withdrawal -----------------------------------------------------------

  async withdraw(userId: string, planId: string) {
    const plan = await this.requireOwnPlan(userId, planId);

    if (plan.status !== SavingPlanStatus.COMPLETED) {
      throw new BadRequestException(
        'This savings plan has not completed its cycle yet. Withdraw will be available once all intervals are collected.',
      );
    }

    if (plan.savingsBalance <= 0) {
      throw new BadRequestException('There is nothing to withdraw.');
    }

    if (plan.lastWithdrawalReference) {
      throw new BadRequestException(
        'A withdrawal is already in progress for this plan. Please wait for it to complete.',
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user?.bankAccount?.paystackRecipientCode) {
      throw new BadRequestException(
        'You need to set a bank account before withdrawing. Add one via the Bank Account section of your wallet.',
      );
    }

    const amount = plan.savingsBalance;
    // A fresh reference per attempt: Paystack treats a reference as used
    // forever once a transfer is created (even a failed one), and the
    // (plan, cycleNumber) pair is stable across retries — so a deterministic
    // reference would be rejected on the second attempt ("Please provide a
    // unique reference"). The random suffix keeps each attempt unique while
    // remaining readable and webhook-matchable via lastWithdrawalReference.
    const reference = `saving_withdraw_${plan._id.toString()}_${plan.cycleNumber}_${randomUUID()}`;

    plan.lastWithdrawalReference = reference;
    await plan.save();

    try {
      const transfer = await this.paystack.initiateTransfer({
        amountNaira: amount,
        recipientCode: user.bankAccount.paystackRecipientCode,
        reason: `Ajo savings withdrawal – ${plan.name}`,
        reference,
      });

      if (transfer.status === 'success') {
        await this.completeWithdrawal(reference);
      } else if (transfer.status === 'otp' && this.paystack.isTestMode()) {
        this.logger.log(
          `Test mode: resolving OTP for savings withdrawal ${transfer.transferCode}`,
        );
        await this.paystack.resolveOtp(
          transfer.transferCode,
          this.paystack.testTransferOtp(),
        );
        await this.completeWithdrawal(reference);
      } else if (transfer.status === 'failed') {
        // Paystack rejected the transfer outright — nothing to finalize later,
        // so release the withdrawal lock now (via failWithdrawal) instead of
        // leaving the plan stuck waiting for a webhook that will never mark it
        // active again.
        throw new InternalServerErrorException(
          `Paystack transfer was rejected (status: failed).`,
        );
      }
      // 'pending' or 'otp' in live mode — the Paystack webhook finalizes.
    } catch (err) {
      this.logger.error(
        `Paystack withdrawal failed for savings plan ${plan._id.toString()}: ${String(err)}`,
      );
      if (this.paystack.isTestMode()) {
        this.logger.error(
          `Paystack transfer failed in test mode. If it required an OTP, set PAYSTACK_TRANSFER_OTP to the code Paystack sent to the dashboard account's registered email/phone (default is 123456).`,
        );
      }
      await this.failWithdrawal(reference, String(err));
      throw new InternalServerErrorException(
        'Withdrawal failed. The savings were not removed — please try again.',
      );
    }

    return this.getPlan(userId, planId);
  }

  /** Finalizes a successful withdrawal (also called from the webhook). */
  async completeWithdrawal(reference: string): Promise<void> {
    const plan = await this.savingPlanModel.findOne({
      lastWithdrawalReference: reference,
    });
    if (!plan) return;
    if (plan.status === SavingPlanStatus.WITHDRAWN) return; // already finalized

    const amount = plan.savingsBalance;
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.savingTxModel.create(
          [
            {
              plan: plan._id,
              user: plan.user,
              type: SavingTransactionType.SAVING_WITHDRAWAL,
              amount,
              reference,
              cycleNumber: plan.cycleNumber,
            },
          ],
          { session },
        );

        plan.savingsBalance = 0;
        plan.status = SavingPlanStatus.WITHDRAWN;
        plan.withdrawnAt = new Date();
        plan.lastWithdrawalReference = undefined;
        await plan.save({ session });
      });
    } finally {
      await session.endSession();
    }

    void this.notificationsService.send(
      NotificationEvents.savingWithdrawn({
        userIds: [plan.user.toString()],
        planName: plan.name,
        amount,
      }),
    );
  }

  /** Handles a failed/reversed withdrawal. Funds were never removed from savingsBalance. */
  async failWithdrawal(reference: string, reason?: string): Promise<void> {
    const plan = await this.savingPlanModel.findOne({
      lastWithdrawalReference: reference,
    });
    if (!plan) return;

    const amount = plan.savingsBalance;
    const failedReference = `${reference}_failed`;

    // The refund audit entry is keyed on the deterministic withdrawal
    // reference, so a re-attempt that fails again (or a webhook racing the
    // local error handler) would otherwise try to insert the same
    // `..._failed` reference twice — rejected by the unique `reference`
    // index with E11000. Make it idempotent: record once, reuse thereafter.
    const alreadyRecorded = await this.savingTxModel.exists({
      reference: failedReference,
    });
    if (!alreadyRecorded) {
      try {
        await this.savingTxModel.create({
          plan: plan._id,
          user: plan.user,
          type: SavingTransactionType.SAVING_REFUND,
          amount,
          reference: failedReference,
          cycleNumber: plan.cycleNumber,
          metadata: { reason: reason ?? 'unknown' },
        });
      } catch (err) {
        // A concurrent webhook / retry recorded the same refund already.
        if (
          err &&
          typeof err === 'object' &&
          (err as { code?: number }).code === 11000
        ) {
          this.logger.warn(
            `Failed-refund already recorded for ${failedReference}; skipping duplicate.`,
          );
        } else {
          throw err;
        }
      }
    }

    plan.lastWithdrawalReference = undefined;
    await plan.save();
  }

  findSavingPlanByWithdrawalReference(reference: string) {
    return this.savingPlanModel.findOne({ lastWithdrawalReference: reference });
  }

  // ---- Continue / delete ----------------------------------------------------

  /** Starts a brand-new cycle after a successful withdrawal. */
  async continuePlan(userId: string, planId: string) {
    const plan = await this.requireOwnPlan(userId, planId);

    if (plan.status !== SavingPlanStatus.WITHDRAWN) {
      throw new BadRequestException(
        'Only a plan whose savings have been withdrawn can be continued.',
      );
    }

    const now = new Date();
    const { intervalCount, endAt } = this.computeCycle(
      now,
      plan.frequency,
      plan.durationUnit ?? SavingDurationUnit.MONTHS,
      plan.durationValue ?? plan.durationMonths ?? 3,
    );
    plan.cycleNumber += 1;
    plan.collectedCount = 0;
    plan.savingsBalance = 0;
    plan.status = SavingPlanStatus.ACTIVE;
    plan.startAt = now;
    plan.intervalCount = intervalCount;
    plan.endAt = endAt;
    plan.withdrawnAt = undefined;
    plan.lastWithdrawalReference = undefined;
    plan.nextDueAt = now; // collect the first interval of the new cycle promptly.
    await plan.save();

    return this.getPlan(userId, planId);
  }

  /**
   * Removes the savings plan. Allowed either after the user withdrew the
   * completed cycle, or before any savings have been collected (created but
   * never debited — safe to cancel outright).
   */
  async deletePlan(userId: string, planId: string) {
    const plan = await this.requireOwnPlan(userId, planId);

    const canDelete =
      plan.status === SavingPlanStatus.WITHDRAWN ||
      (plan.status === SavingPlanStatus.ACTIVE &&
        plan.collectedCount === 0 &&
        plan.savingsBalance === 0);

    if (!canDelete) {
      throw new BadRequestException(
        'Savings have already started on this plan. Withdraw the accumulated amount before deleting it.',
      );
    }

    plan.status = SavingPlanStatus.DELETED;
    plan.deletedAt = new Date();
    await plan.save();

    return { deleted: true };
  }
}
