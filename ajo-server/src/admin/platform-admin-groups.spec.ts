import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PlatformAdminGroupsService } from './platform-admin-groups.service';
import { PlatformAdminGroupsController } from './platform-admin-groups.controller';

/**
 * Focused unit tests for the platform-admin group mutations
 * (`PATCH /admin/groups/:id/service-fee`). The service's other methods
 * (listGroups / getGroupDetail) are heavily DB-driven, so here we stub the
 * models and spy on getGroupDetail to isolate updateServiceFee.
 */

const VALID_ID = new Types.ObjectId().toString();

function buildService(overrides: {
  findById?: jest.Mock;
  getGroupDetail?: jest.Mock;
}) {
  const groupModel = {
    findById: overrides.findById ?? jest.fn(),
  };

  const service = new PlatformAdminGroupsService(
    groupModel as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const getGroupDetail =
    overrides.getGroupDetail ??
    jest.fn().mockResolvedValue({ id: VALID_ID, serviceFee: 0 });

  jest.spyOn(service, 'getGroupDetail').mockImplementation(getGroupDetail);

  return { service, groupModel, getGroupDetail };
}

describe('PlatformAdminGroupsService.updateServiceFee', () => {
  it('throws NotFound for a malformed group id', async () => {
    const { service } = buildService({});
    await expect(
      service.updateServiceFee('not-an-object-id', 100),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when the group does not exist', async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.updateServiceFee(VALID_ID, 100),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists the new fee and returns the refreshed detail', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const groupDoc = { serviceFee: 0, save };
    const { service, getGroupDetail } = buildService({
      findById: jest.fn().mockResolvedValue(groupDoc),
    });
    getGroupDetail.mockResolvedValue({ id: VALID_ID, serviceFee: 250 });

    const result = await service.updateServiceFee(VALID_ID, 250);

    expect(groupDoc.serviceFee).toBe(250);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.serviceFee).toBe(250);
  });

  it('skips the write when no fee is supplied', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const groupDoc = { serviceFee: 250, save };
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(groupDoc),
    });

    await service.updateServiceFee(VALID_ID, undefined);

    expect(save).not.toHaveBeenCalled();
  });
});

describe('PlatformAdminGroupsController.updateServiceFee', () => {
  it('passes dto.serviceFee to the service and returns the result', async () => {
    const service = {
      updateServiceFee: jest.fn().mockResolvedValue({
        id: VALID_ID,
        serviceFee: 250,
      }),
    };
    const controller = new PlatformAdminGroupsController(service as never);

    const result = await controller.updateServiceFee(VALID_ID, {
      serviceFee: 250,
    });

    expect(service.updateServiceFee).toHaveBeenCalledWith(VALID_ID, 250);
    expect(result.serviceFee).toBe(250);
  });
});
