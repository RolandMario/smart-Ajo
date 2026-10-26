import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Body of `PATCH /admin/settings/service-charges`. Only the fields provided
 * are changed — omitting one keeps its current value.
 */
export class UpdateServiceChargesDto {
  /** % charged on wallet -> escrow transfers (e.g. 1 = 1%). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  escrowTransferFeePercent?: number;

  /** % charged on bank payouts (e.g. 2.5 = 2.5%). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  payoutFeePercent?: number;
}
