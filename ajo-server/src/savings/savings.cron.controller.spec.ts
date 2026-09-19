import { Test, TestingModule } from '@nestjs/testing';
import { SavingsCronController } from './savings.cron.controller';
import { SavingsService } from './savings.service';

describe('SavingsCronController', () => {
  let controller: SavingsCronController;
  const savingsService = {
    processDuePlans: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingsCronController],
      providers: [{ provide: SavingsService, useValue: savingsService }],
    }).compile();

    controller = module.get<SavingsCronController>(SavingsCronController);
  });

  it('runs the savings auto-collect job', async () => {
    const result = await controller.runSavingsAutoCollect();

    expect(savingsService.processDuePlans).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.job).toBe('savings-auto-collect');
  });
});