import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PlatformAdminGroupsService } from './platform-admin-groups.service';
import { PlatformAdminGroupsController } from './platform-admin-groups.controller';

/**
 * Focused unit tests for the platform-admin auto-collect override
 * (`PATCH /admin/groups/:id/auto-collect`). The service's other methods
 * (listGroups / getGroupDetail) are heavily DB-driven, so here we stub
 * the models and spy on getGroupDetail to isolate setAutoCollect.
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
    jest.fn().mockResolvedValue({ id: VALID_ID, autoCollectEnabled: false });

  jest.spyOn(service, 'getGroupDetail').mockImplementation(getGroupDetail);

  return { service, groupModel, getGroupDetail };
}

describe('PlatformAdminGroupsService.setAutoCollect', () => {
  it('throws NotFound for a malformed group id', async () => {
    const { service } = buildService({});
    await expect(service.setAutoCollect('not-an-object-id', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFound when the group does not exist', async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(null),
    });
    await expect(service.setAutoCollect(VALID_ID, true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sets autoCollectEnabled to true and persists when enabling', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const groupDoc = { autoCollectEnabled: false, save };
    const { service, getGroupDetail } = buildService({
      findById: jest.fn().mockResolvedValue(groupDoc),
    });
    getGroupDetail.mockResolvedValue({ id: VALID_ID, autoCollectEnabled: true });

    const result = await service.setAutoCollect(VALID_ID, true);

    expect(groupDoc.autoCollectEnabled).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.autoCollectEnabled).toBe(true);
  });

  it('sets autoCollectEnabled to false and persists when disabling', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const groupDoc = { autoCollectEnabled: true, save };
    const { service, getGroupDetail } = buildService({
      findById: jest.fn().mockResolvedValue(groupDoc),
    });
    getGroupDetail.mockResolvedValue({ id: VALID_ID, autoCollectEnabled: false });

    const result = await service.setAutoCollect(VALID_ID, false);

    expect(groupDoc.autoCollectEnabled).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.autoCollectEnabled).toBe(false);
  });
});

describe('PlatformAdminGroupsController.setAutoCollect', () => {
  it('passes dto.enabled to the service and returns the result', async () => {
    const service = {
      setAutoCollect: jest.fn().mockResolvedValue({
        id: VALID_ID,
        autoCollectEnabled: true,
      }),
    };
    const controller = new PlatformAdminGroupsController(
      service as never,
    );

    const result = await controller.setAutoCollect(VALID_ID, { enabled: true });

    expect(service.setAutoCollect).toHaveBeenCalledWith(VALID_ID, true);
    expect(result.autoCollectEnabled).toBe(true);
  });
});
