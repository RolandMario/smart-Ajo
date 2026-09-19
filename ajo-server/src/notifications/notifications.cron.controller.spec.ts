import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsCronController } from './notifications.cron.controller';
import { AutoCollectScheduler } from './auto-collect.scheduler';
import { ReminderScheduler } from './reminder.scheduler';
import { DefaulterScheduler } from './defaulter.scheduler';

describe('NotificationsCronController', () => {
  let controller: NotificationsCronController;
  const autoCollectScheduler = {
    autoCollectDueCycles: jest.fn().mockResolvedValue(undefined),
  };
  const reminderScheduler = {
    sendContributionReminders: jest.fn().mockResolvedValue(undefined),
  };
  const defaulterScheduler = {
    flagDefaulters: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsCronController],
      providers: [
        { provide: AutoCollectScheduler, useValue: autoCollectScheduler },
        { provide: ReminderScheduler, useValue: reminderScheduler },
        { provide: DefaulterScheduler, useValue: defaulterScheduler },
      ],
    }).compile();

    controller = module.get<NotificationsCronController>(
      NotificationsCronController,
    );
  });

  it('runs the group auto-collect job', async () => {
    const result = await controller.runAutoCollect();

    expect(autoCollectScheduler.autoCollectDueCycles).toHaveBeenCalledTimes(1);
    expect(result.job).toBe('auto-collect');
  });

  it('runs the reminder job', async () => {
    const result = await controller.runReminders();

    expect(reminderScheduler.sendContributionReminders).toHaveBeenCalledTimes(
      1,
    );
    expect(result.job).toBe('contribution-reminders');
  });

  it('runs the defaulter flagging job', async () => {
    const result = await controller.runDefaulters();

    expect(defaulterScheduler.flagDefaulters).toHaveBeenCalledTimes(1);
    expect(result.job).toBe('defaulter-flagging');
  });
});