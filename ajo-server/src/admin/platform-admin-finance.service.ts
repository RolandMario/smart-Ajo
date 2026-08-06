import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from '../wallet/schemas/wallet-transaction.schema';
import { Payout, PayoutDocument } from '../cycles/schemas/payout.schema';
import {
  GroupWalletTransaction,
  GroupWalletTransactionDocument,
} from '../cycles/schemas/group-wallet-transaction.schema';
import { Cycle, CycleDocument } from '../cycles/schemas/cycle.schema';
import { ListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { ListGroupWalletTransactionsQueryDto } from './dto/list-group-wallet-transactions-query.dto';
import { WalletTransactionType } from '../common/enums/wallet.enum';

export interface PaginatedWalletTransactions {
  transactions: Array<{
    id: string;
    user: { id: string; name?: string; phone: string };
    type: string;
    status: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    reference: string;
    group?: { id: string; name: string };
    createdAt: Date;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedPayouts {
  payouts: Array<{
    id: string;
    group: { id: string; name: string };
    cycleNumber: number;
    recipient: { id: string; name?: string; phone: string };
    initiatedBy: { id: string; name?: string; phone: string };
    amount: number;
    status: string;
    failureReason?: string;
    paystackReference: string;
    completedAt?: Date;
    createdAt: Date;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedGroupWalletTransactions {
  transactions: Array<{
    id: string;
    group: { id: string; name: string };
    type: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    createdAt: Date;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Platform-admin-scoped read access to every financial ledger on the
 * platform — for the admin web console's Financial Oversight screen
 * (Sub-phase D). Covers three distinct ledgers, each with its own
 * existing schema:
 *  - WalletTransaction: a member's PERSONAL wallet (funding, debits,
 *    refunds). This screen filters to FUNDING by default since that's
 *    the support-relevant slice ("did my top-up go through") — other
 *    types are visible by passing `type` explicitly.
 *  - Payout: transfers OUT of a group's central account to a cycle's
 *    recipient. Includes every status, not just successes — same
 *    transparency decision as Sub-phase C's group detail payout history.
 *  - GroupWalletTransaction: a GROUP's central account ledger
 *    (contribution credits, payout debits, reversal credits) — the
 *    platform-wide version of what Sub-phase C's group detail page
 *    already showed scoped to one group.
 */
@Injectable()
export class PlatformAdminFinanceService {
  constructor(
    @InjectModel(WalletTransaction.name)
    private walletTxModel: Model<WalletTransactionDocument>,
    @InjectModel(Payout.name) private payoutModel: Model<PayoutDocument>,
    @InjectModel(GroupWalletTransaction.name)
    private groupWalletTxModel: Model<GroupWalletTransactionDocument>,
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
  ) {}

  // ---- Wallet fundings (personal wallet ledger) -------------------------------

  async listWalletTransactions(
    query: ListWalletTransactionsQueryDto,
  ): Promise<PaginatedWalletTransactions> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {
      // Default to FUNDING — the "Wallet Fundings" tab's purpose — but
      // allow an explicit type to widen/narrow the view.
      type: query.type ?? WalletTransactionType.FUNDING,
    };

    if (query.status) filter.status = query.status;
    if (query.userId) filter.user = new Types.ObjectId(query.userId);

    const [transactions, total] = await Promise.all([
      this.walletTxModel
        .find(filter)
        .populate('user', 'name phone')
        .populate('group', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.walletTxModel.countDocuments(filter),
    ]);

    return {
      transactions: transactions.map((tx) => {
        const user = tx.user as unknown as {
          _id: Types.ObjectId;
          name?: string;
          phone: string;
        };
        const group = tx.group as unknown as
          | { _id: Types.ObjectId; name: string }
          | undefined;

        return {
          id: tx._id.toString(),
          user: { id: user._id.toString(), name: user.name, phone: user.phone },
          type: tx.type,
          status: tx.status,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          reference: tx.reference,
          group: group
            ? { id: group._id.toString(), name: group.name }
            : undefined,
          createdAt: (tx as unknown as { createdAt: Date }).createdAt,
        };
      }),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ---- Payouts (group central account -> recipient) --------------------------

  async listPayouts(query: ListPayoutsQueryDto): Promise<PaginatedPayouts> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.groupId) filter.group = new Types.ObjectId(query.groupId);

    const [payouts, total] = await Promise.all([
      this.payoutModel
        .find(filter)
        .populate('group', 'name')
        .populate('recipientUser', 'name phone')
        .populate('initiatedBy', 'name phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.payoutModel.countDocuments(filter),
    ]);

    const cycleIds = payouts.map((p) => p.cycle);
    const cycles = await this.cycleModel
      .find({ _id: { $in: cycleIds } })
      .select('cycleNumber')
      .lean();
    const cycleNumberById = new Map(
      cycles.map((c) => [c._id.toString(), c.cycleNumber]),
    );

    return {
      payouts: payouts.map((p) => {
        const group = p.group as unknown as {
          _id: Types.ObjectId;
          name: string;
        };
        const recipient = p.recipientUser as unknown as {
          _id: Types.ObjectId;
          name?: string;
          phone: string;
        };
        const initiator = p.initiatedBy as unknown as {
          _id: Types.ObjectId;
          name?: string;
          phone: string;
        };

        return {
          id: p._id.toString(),
          group: { id: group._id.toString(), name: group.name },
          cycleNumber: cycleNumberById.get(p.cycle.toString()) ?? 0,
          recipient: {
            id: recipient._id.toString(),
            name: recipient.name,
            phone: recipient.phone,
          },
          initiatedBy: {
            id: initiator._id.toString(),
            name: initiator.name,
            phone: initiator.phone,
          },
          amount: p.amount,
          status: p.status,
          failureReason: p.failureReason,
          paystackReference: p.paystackReference,
          completedAt: p.completedAt,
          createdAt: (p as unknown as { createdAt: Date }).createdAt,
        };
      }),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ---- Group wallet ledger (central account movements) -----------------------

  async listGroupWalletTransactions(
    query: ListGroupWalletTransactionsQueryDto,
  ): Promise<PaginatedGroupWalletTransactions> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {};

    if (query.type) filter.type = query.type;
    if (query.groupId) filter.group = new Types.ObjectId(query.groupId);

    const [transactions, total] = await Promise.all([
      this.groupWalletTxModel
        .find(filter)
        .populate('group', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.groupWalletTxModel.countDocuments(filter),
    ]);

    return {
      transactions: transactions.map((tx) => {
        const group = tx.group as unknown as {
          _id: Types.ObjectId;
          name: string;
        };

        return {
          id: tx._id.toString(),
          group: { id: group._id.toString(), name: group.name },
          type: tx.type,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          createdAt: (tx as unknown as { createdAt: Date }).createdAt,
        };
      }),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
