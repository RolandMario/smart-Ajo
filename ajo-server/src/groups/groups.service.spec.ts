import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { GroupsService } from './groups.service';

/**
 * Focused unit tests for the Group-ID join flow:
 *   - searchGroupByCode (Join Group screen's search step)
 *   - joinGroupByCode (become an ACCEPTED member by entering the Group ID)
 *
 * The constructor's other model dependencies (cycles, contributions, group
 * wallets) aren't exercised here, so they're stubbed.
 */

function makeGroup(overrides: Record<string, unknown> = {}) {
  const plain = {
    _id: new Types.ObjectId(),
    joinCode: 'ABCD1234',
    name: 'Family Savings',
    status: 'open_for_invites',
    totalSlots: 5,
    createdBy: new Types.ObjectId(),
    contributionAmount: 5000,
    frequency: 'monthly',
    rotationMethod: 'random',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const merged = { ...plain, ...overrides };
  // toObject() is what the service returns to the client.
  return { ...merged, toObject: () => merged };
}

function buildService(overrides: {
  groupFindOne?: jest.Mock;
  memberCount?: jest.Mock;
  memberFindOne?: jest.Mock;
  memberCreate?: jest.Mock;
  populateMember?: jest.Mock;
  userFindById?: jest.Mock;
}) {
  const groupModel = {
    findOne: overrides.groupFindOne ?? jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  };

  const groupMemberModel = {
    countDocuments: overrides.memberCount ?? jest.fn(),
    findOne: overrides.memberFindOne ?? jest.fn(),
    create: overrides.memberCreate ?? jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
  };

  const usersService = {
    findById: overrides.userFindById ?? jest.fn().mockResolvedValue(null),
  };

  const notificationsService = { send: jest.fn().mockResolvedValue(undefined) };

  const service = new GroupsService(
    groupModel as never,
    groupMemberModel as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    usersService as never,
    {} as never,
    notificationsService as never,
  );

  // populateMember is private; stub it to return a ready-to-return member.
  const populateMember =
    overrides.populateMember ??
    jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), user: {} });

  jest
    .spyOn(service as never, 'populateMember')
    .mockImplementation(populateMember as never);

  return {
    service,
    groupModel,
    groupMemberModel,
    usersService,
    notificationsService,
    populateMember,
  };
}

describe('GroupsService.searchGroupByCode', () => {
  it('throws NotFound when no group matches the code', async () => {
    const { service } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.searchGroupByCode('u1', 'XXXX'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound for a TERMINATED group', async () => {
    const { service } = buildService({
      groupFindOne: jest
        .fn()
        .mockResolvedValue(makeGroup({ status: 'terminated' })),
    });
    await expect(
      service.searchGroupByCode('u1', 'ABCD'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports joinable=true for an open group with spare slots', async () => {
    const group = makeGroup({ totalSlots: 5 });
    const { service } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(group),
      memberCount: jest.fn().mockResolvedValue(2),
      memberFindOne: jest.fn().mockResolvedValue(null),
    });

    const result = await service.searchGroupByCode(
      new Types.ObjectId().toString(),
      'abcd1234',
    );

    expect(result.joinable).toBe(true);
    expect(result.isMember).toBe(false);
    expect(result.isFull).toBe(false);
    expect(result.memberCount).toBe(2);
    expect(result.group.joinCode).toBe('ABCD1234');
  });

  it('reports joinable=false for the group admin', async () => {
    const adminId = new Types.ObjectId().toString();
    const group = makeGroup({ createdBy: new Types.ObjectId(adminId) });
    const { service } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(group),
      memberCount: jest.fn().mockResolvedValue(2),
      memberFindOne: jest
        .fn()
        .mockResolvedValue({ isGroupAdmin: true, inviteStatus: 'accepted' }),
    });

    const result = await service.searchGroupByCode(adminId, 'ABCD1234');

    expect(result.isAdmin).toBe(true);
    expect(result.joinable).toBe(false);
  });
});

describe('GroupsService.joinGroupByCode', () => {
  const USER_ID = new Types.ObjectId().toString();

  it('throws NotFound when the code does not resolve', async () => {
    const { service } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.joinGroupByCode(USER_ID, 'NOPE'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequest when the group is not open for new members', async () => {
    const { service } = buildService({
      groupFindOne: jest
        .fn()
        .mockResolvedValue(makeGroup({ status: 'active' })),
    });
    await expect(
      service.joinGroupByCode(USER_ID, 'ABCD1234'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws Conflict when the caller is the group admin', async () => {
    const group = makeGroup({ createdBy: new Types.ObjectId(USER_ID) });
    const { service } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(group),
    });
    await expect(
      service.joinGroupByCode(USER_ID, 'ABCD1234'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws Conflict when the caller is already an accepted member', async () => {
    const { service } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(makeGroup()),
      memberFindOne: jest.fn().mockResolvedValue({ inviteStatus: 'accepted' }),
    });
    await expect(
      service.joinGroupByCode(USER_ID, 'ABCD1234'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws BadRequest when the group has no free slots', async () => {
    const { service } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(makeGroup({ totalSlots: 5 })),
      memberFindOne: jest.fn().mockResolvedValue(null),
      memberCount: jest.fn().mockResolvedValue(5),
    });
    await expect(
      service.joinGroupByCode(USER_ID, 'ABCD1234'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an ACCEPTED membership and notifies the admin on success', async () => {
    const adminMembership = { user: new Types.ObjectId() };
    const membershipDoc = { _id: new Types.ObjectId(), isGroupAdmin: false };
    const populatedMembership = {
      _id: membershipDoc._id,
      user: { _id: USER_ID },
    };
    const group = makeGroup();

    const { service, groupMemberModel, notificationsService } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(group),
      memberFindOne: jest.fn().mockResolvedValue(null),
      memberCount: jest.fn().mockResolvedValue(2),
      memberCreate: jest.fn().mockResolvedValue(membershipDoc),
      populateMember: jest.fn().mockResolvedValue(populatedMembership),
      userFindById: jest
        .fn()
        .mockResolvedValue({ name: 'Ada', phone: '+2348' }),
    });

    // findOne is used twice: existing membership (null) then admin lookup.
    groupMemberModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(adminMembership);

    const result = await service.joinGroupByCode(USER_ID, 'ABCD1234');

    expect(groupMemberModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        group: group._id,
        inviteStatus: 'accepted',
        isGroupAdmin: false,
      }),
    );
    expect(notificationsService.send).toHaveBeenCalledTimes(1);
    expect(result.membership).toBe(populatedMembership);
    expect(result.group.joinCode).toBe('ABCD1234');
  });

  it('upgrades a legacy PENDING invite to ACCEPTED instead of duplicating', async () => {
    const existingDoc = {
      _id: new Types.ObjectId(),
      inviteStatus: 'pending',
      respondedAt: undefined,
      save: jest.fn().mockImplementation(function (
        this: Record<string, unknown>,
      ) {
        return Promise.resolve(this);
      }),
    };
    const populatedMembership = { _id: existingDoc._id, user: {} };
    const { service, groupMemberModel } = buildService({
      groupFindOne: jest.fn().mockResolvedValue(makeGroup()),
      memberFindOne: jest.fn().mockResolvedValue(existingDoc),
      memberCount: jest.fn().mockResolvedValue(2),
      populateMember: jest.fn().mockResolvedValue(populatedMembership),
    });
    groupMemberModel.findOne
      .mockResolvedValueOnce(existingDoc)
      .mockResolvedValueOnce(null);

    await service.joinGroupByCode(USER_ID, 'ABCD1234');

    expect(existingDoc.inviteStatus).toBe('accepted');
    expect(existingDoc.save).toHaveBeenCalledTimes(1);
    // One record — we upgraded instead of create()-ing a second.
    expect(groupMemberModel.create).not.toHaveBeenCalled();
  });
});
