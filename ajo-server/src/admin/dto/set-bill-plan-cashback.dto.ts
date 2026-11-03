import { IsNumber, Max, Min } from 'class-validator';

/**
 * Body of `PATCH /admin/bills/plans/:id/cashback` — the percentage of the
 * purchase amount the member gets back on that plan.
 *
 * Decimals are allowed (`0.5` = half a percent); `0` switches cashback off.
 */
export class SetBillPlanCashbackDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cashbackPercent!: number;
}
