import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { GroupsService } from './groups.service';

/**
 * Focused unit tests for `GroupsService.terminateGroup` — the admin action
 * that ends a COMPLETED group.
 *
 * The behaviour these lock down: terminating no longer flips `status` to
 * TERMINATED and leaves the row behind. The group and everything that belongs
 * to it are deleted from the database in one transaction, so no orphaned
 * memberships, cycles, contributions, wallet ledgers, escrow deposits, or
 * payouts survive the deletion.
 */

const GROUP_ID = new Types.ObjectId();
const ADMIN_ID = new Types.ObjectId();
const MEMBER_USER_ID = new Types.ObjectId();

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    _id: GROUP_ID,
    name: 'Family Savings',
    status: 'completed',
    ...overrides,
  };
}

function buildService(
  overrides: {
    group?: ReturnType<typeof makeGroup>;
    members?: Array<{ user: Types.ObjectId }>;
    /** `null` means the group never got a central account. */
    groupWallet?: { balance: number } | null;
    assertGroupAdmin?: jest.Mock;
  } = {},
) {
  const group = overrides.group ?? makeGroup();
  const members = overrides.members ?? [{ user: MEMBER_USER_ID }];
  const groupWallet =
    overrides.groupWallet === undefined
      ? { balance: 0 }
      : overrides.groupWallet;

  const session = {
    withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn(),
  };
  const connection = {
    startSession: jest.fn().mockResolvedValue(session),
  };

  const groupModel = {
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const groupMemberModel = {
    find: jest.fn().mockResolvedValue(members),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: members.length }),
  };
  const cycleModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const contributionModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
  };
  const groupWalletModel = {
    findOne: jest.fn().mockResolvedValue(groupWallet),
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

  const notificationsService = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const groupAccess = {
    getGroupOrThrow: jest.fn().mockResolvedValue(group),
    assertGroupAdmin:
      overrides.assertGroupAdmin ?? jest.fn().mockResolvedValue({}),
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
    {} as never, // usersService — unused by terminateGroup
    groupAccess as never,
    notificationsService as never,
  );

  return {
    service,
    groupModel,
    groupMemberModel,
    cycleModel,
    contributionModel,
    groupWalletModel,
    groupWalletTxModel,
    escrowDepositModel,
    payoutModel,
    notificationsService,
    groupAccess,
    session,
    connection,
  };
}

describe('GroupsService.terminateGroup', () => {
  it('deletes the group and every record that belongs to it', async () => {
    const ctx = buildService();

    const result = await ctx.service.terminateGroup(
      ADMIN_ID.toString(),
      GROUP_ID.toString(),
    );

    expect(ctx.groupAccess.assertGroupAdmin).toHaveBeenCalledWith(
      GROUP_ID,
      ADMIN_ID.toString(),
    );
    expect(ctx.session.withTransaction).toHaveBeenCalledTimes(1);

    // Every group-scoped collection is cleared inside the transaction…
    const scopedDelete = [{ group: GROUP_ID }, { session: ctx.session }];
    expect(ctx.groupMemberModel.deleteMany).toHaveBeenCalledWith(
      ...scopedDelete,
    );
    expect(ctx.cycleModel.deleteMany).toHaveBeenCalledWith(...scopedDelete);
    expect(ctx.contributionModel.deleteMany).toHaveBeenCalledWith(
      ...scopedDelete,
    );
    expect(ctx.groupWalletModel.deleteMany).toHaveBeenCalledWith(
      ...scopedDelete,
    );
    expect(ctx.groupWalletTxModel.deleteMany).toHaveBeenCalledWith(
      ...scopedDelete,
    );
    expect(ctx.escrowDepositModel.deleteMany).toHaveBeenCalledWith(
      ...scopedDelete,
    );
    expect(ctx.payoutModel.deleteMany).toHaveBeenCalledWith(...scopedDelete);

    // …and the group itself is dropped, not marked TERMINATED.
    expect(ctx.groupModel.deleteOne).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { session: ctx.session },
    );
    expect(ctx.session.endSession).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      groupId: GROUP_ID.toString(),
      status: 'terminated',
    });
  });

  it('notifies the accepted members after the group is deleted', async () => {
    const otherMember = new Types.ObjectId();
    const ctx = buildService({
      members: [{ user: MEMBER_USER_ID }, { user: otherMember }],
    });

    await ctx.service.terminateGroup(ADMIN_ID.toString(), GROUP_ID.toString());

    expect(ctx.notificationsService.send).toHaveBeenCalledTimes(1);
    expect(ctx.notificationsService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [MEMBER_USER_ID.toString(), otherMember.toString()],
        groupName: 'Family Savings',
        title: 'Group Terminated',
        data: { groupId: GROUP_ID.toString() },
      }),
    );
  });

  it('only terminates COMPLETED groups', async () => {
    const ctx = buildService({ group: makeGroup({ status: 'active' }) });

    await expect(
      ctx.service.terminateGroup(ADMIN_ID.toString(), GROUP_ID.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.connection.startSession).not.toHaveBeenCalled();
    expect(ctx.groupMemberModel.deleteMany).not.toHaveBeenCalled();
    expect(ctx.groupModel.deleteOne).not.toHaveBeenCalled();
  });

  it('refuses to delete a group whose central account still holds money', async () => {
    const ctx = buildService({ groupWallet: { balance: 25000 } });

    await expect(
      ctx.service.terminateGroup(ADMIN_ID.toString(), GROUP_ID.toString()),
    ).rejects.toThrow(/still holds/);

    expect(ctx.connection.startSession).not.toHaveBeenCalled();
    expect(ctx.groupModel.deleteOne).not.toHaveBeenCalled();
  });

  it('treats a group without a central account as safe to delete', async () => {
    const ctx = buildService({ groupWallet: null });

    await ctx.service.terminateGroup(ADMIN_ID.toString(), GROUP_ID.toString());

    expect(ctx.groupModel.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('does not delete anything when the caller is not the group admin', async () => {
    const ctx = buildService({
      assertGroupAdmin: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('Only the group admin')),
    });

    await expect(
      ctx.service.terminateGroup(
        MEMBER_USER_ID.toString(),
        GROUP_ID.toString(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(ctx.groupMemberModel.find).not.toHaveBeenCalled();
    expect(ctx.connection.startSession).not.toHaveBeenCalled();
    expect(ctx.groupModel.deleteOne).not.toHaveBeenCalled();
  });
});
