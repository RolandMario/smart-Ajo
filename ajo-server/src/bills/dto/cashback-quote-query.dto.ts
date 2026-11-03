import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Query of `GET /bills/cashback-quote` — the "You'll earn ₦0.5 cashback"
 * banner on the app's confirm screen.
 *
 * The server re-prices data/cable from its own catalogue, so only the plan
 * code is needed there; airtime and electricity (and cable renewals) pass the
 * amount they are about to pay.
 */
export class CashbackQuoteQueryDto {
  @IsIn(['airtime', 'data', 'cable', 'electricity'])
  serviceType!: 'airtime' | 'data' | 'cable' | 'electricity';

  /** Network, cable provider or disco — e.g. `mtn`, `dstv`, `ikedc`. */
  @IsOptional()
  @IsString()
  provider?: string;

  /** Data plan code or cable bouquet code. */
  @IsOptional()
  @IsString()
  variationCode?: string;

  /** Amount about to be paid (airtime, electricity, cable renewal). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  amount?: number;

  /** Cable renewals: the bouquet VTpass reported for the decoder. */
  @IsOptional()
  @IsString()
  packageName?: string;
}
