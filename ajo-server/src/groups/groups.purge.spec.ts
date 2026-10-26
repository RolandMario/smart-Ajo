import { Types } from 'mongoose';
import { GroupStatus } from '../common/enums/group.enum';
import { GroupsService } from './groups.service';

/**
 * Focused unit tests for `GroupsService.purgeTerminatedGroups` — the legacy
 * cleanup behind `npm run seed:purge-terminated-groups`.
 *
 * Groups terminated by older API versions were only marked TERMINATED; the row
 * and everything scoped to it stayed in the database. The script purges them
 * through the same cascade live termination uses (`purgeGroup`), but must never
 * delete a group that still holds member money — that balance has to be paid
 * out first, exactly like `terminateGroup` refuses to.
 */

const GROUP_A = new Types.ObjectId();
const GROUP_B = new Types.ObjectId();

interface LegacyGroup {
  _id: Types.ObjectId;
  name: string;
}

function buildService(
  options: {
    terminated?: LegacyGroup[];
    /** Central-account balance per group id; missing means no GroupWallet. */
    balances?: Record<string, number>;
  } = {},
) {
  const terminated = options.terminated ?? [
    { _id: GROUP_A, name: 'Legacy Circle A' },
    { _id: GROUP_B, name: 'Legacy Circle B' },
  ];
  const balances = options.balances ?? {};

  const session = {
    withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn(),
  };
  const connection = {
    startSession: jest.fn().mockResolvedValue(session),
  };

  const selectGroups = jest.fn().mockResolvedValue(terminated);
  const groupModel = {
    find: jest.fn(() => ({ select: selectGroups })),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const groupMemberModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
  };
  const cycleModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const contributionModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 3 }),
  };
  const groupWalletModel = {
    findOne: jest.fn(({ group }: { group: Types.ObjectId }) => {
      const balance = balances[group.toString()];
      return {
        select: jest
          .fn()
          .mockResolvedValue(balance === undefined ? null : { balance }),
      };
    }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const groupWalletTxModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
  };
  const escrowDepositModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const payoutModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };

  const service = new GroupsService(
    groupModel as never,
    groupMemberModel as never,
    cycleModel as never,
    contributionModel as never,
    groupWalletModel as never,
    groupWalletTxModel as never,
    escrowDepositModel as never,
    payoutModel as never,
    connection as never,
    {} as never, // usersService — unused by the purge
    {} as never, // groupAccess — unused by the purge
    {} as never, // notificationsService — unused by the purge
  );

  return {
    service,
    session,
    connection,
    groupModel,
    selectGroups,
    groupMemberModel,
    cycleModel,
    contributionModel,
    groupWalletModel,
    groupWalletTxModel,
    escrowDepositModel,
    payoutModel,
  };
}

describe('GroupsService.purgeTerminatedGroups', () => {
  it('looks up exactly the legacy terminated groups', async () => {
    const ctx = buildService({ terminated: [] });

    await ctx.service.purgeTerminatedGroups();

    expect(ctx.groupModel.find).toHaveBeenCalledWith({
      status: GroupStatus.TERMINATED,
    });
    expect(ctx.selectGroups).toHaveBeenCalledWith('name');
  });

  it('purges every terminated group with the same cascade live termination uses', async () => {
    const ctx = buildService();

    const result = await ctx.service.purgeTerminatedGroups();

    expect(result).toEqual({
      dryRun: false,
      scanned: 2,
      purged: [
        { id: GROUP_A.toString(), name: 'Legacy Circle A' },
        { id: GROUP_B.toString(), name: 'Legacy Circle B' },
      ],
      skipped: [],
    });

    const scopedToA = [{ group: GROUP_A }, { session: ctx.session }] as const;
    expect(ctx.groupWalletTxModel.deleteMany).toHaveBeenCalledWith(
      ...scopedToA,
    );
    expect(ctx.escrowDepositModel.deleteMany).toHaveBeenCalledWith(
      ...scopedToA,
    );
    expect(ctx.payoutModel.deleteMany).toHaveBeenCalledWith(...scopedToA);
    expect(ctx.contributionModel.deleteMany).toHaveBeenCalledWith(...scopedToA);
    expect(ctx.cycleModel.deleteMany).toHaveBeenCalledWith(...scopedToA);
    expect(ctx.groupWalletModel.deleteMany).toHaveBeenCalledWith(...scopedToA);
    expect(ctx.groupMemberModel.deleteMany).toHaveBeenCalledWith(...scopedToA);
    expect(ctx.groupModel.deleteOne).toHaveBeenCalledWith(
      { _id: GROUP_A },
      { session: ctx.session },
    );

    // …and again for the second legacy group, each in its own transaction.
    expect(ctx.groupModel.deleteOne).toHaveBeenCalledWith(
      { _id: GROUP_B },
      { session: ctx.session },
    );
    expect(ctx.connection.startSession).toHaveBeenCalledTimes(2);
    expect(ctx.session.endSession).toHaveBeenCalledTimes(2);
  });

  it('skips a legacy group whose central account still holds money', async () => {
    const ctx = buildService({
      balances: { [GROUP_B.toString()]: 25000 },
    });

    const result = await ctx.service.purgeTerminatedGroups();

    expect(result.purged).toEqual([
      { id: GROUP_A.toString(), name: 'Legacy Circle A' },
    ]);
    expect(result.skipped).toEqual([
      { id: GROUP_B.toString(), name: 'Legacy Circle B', balance: 25000 },
    ]);

    expect(ctx.groupModel.deleteOne).toHaveBeenCalledTimes(1);
    expect(ctx.groupModel.deleteOne).toHaveBeenCalledWith(
      { _id: GROUP_A },
      { session: ctx.session },
    );
    expect(ctx.groupMemberModel.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('reports without deleting on a dry run', async () => {
    const ctx = buildService({ balances: { [GROUP_B.toString()]: 5000 } });

    const result = await ctx.service.purgeTerminatedGroups({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.purged).toEqual([
      { id: GROUP_A.toString(), name: 'Legacy Circle A' },
    ]);
    expect(result.skipped).toEqual([
      { id: GROUP_B.toString(), name: 'Legacy Circle B', balance: 5000 },
    ]);

    expect(ctx.connection.startSession).not.toHaveBeenCalled();
    expect(ctx.groupModel.deleteOne).not.toHaveBeenCalled();
    expect(ctx.groupMemberModel.deleteMany).not.toHaveBeenCalled();
    expect(ctx.groupWalletModel.deleteMany).not.toHaveBeenCalled();
  });

  it('does nothing when no group is marked terminated', async () => {
    const ctx = buildService({ terminated: [] });

    await expect(ctx.service.purgeTerminatedGroups()).resolves.toEqual({
      dryRun: false,
      scanned: 0,
      purged: [],
      skipped: [],
    });

    expect(ctx.groupWalletModel.findOne).not.toHaveBeenCalled();
    expect(ctx.connection.startSession).not.toHaveBeenCalled();
  });

  it('treats a group without a central account as safe to delete', async () => {
    const ctx = buildService({
      terminated: [{ _id: GROUP_A, name: 'No Wallet' }],
    });

    await ctx.service.purgeTerminatedGroups();

    expect(ctx.groupModel.deleteOne).toHaveBeenCalledWith(
      { _id: GROUP_A },
      { session: ctx.session },
    );
  });
});
