import {
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PurchaseElectricityDto {
  @IsDefined()
  @IsString()
  disco!: string;

  @IsDefined()
  @IsString()
  meterNumber!: string;

  @IsDefined()
  @IsEnum(['prepaid', 'postpaid'])
  meterType!: 'prepaid' | 'postpaid';

  /** VTpass electricity limits: ₦500 minimum, ₦500,000 maximum. */
  @IsDefined()
  @IsNumber()
  @IsInt()
  @Min(500)
  @Max(500_000)
  amount!: number;

  /**
   * Deprecated and ignored: VTpass marks `phone` mandatory on the electricity
   * payload (the token SMS goes there), but the member's own number is the
   * right recipient — the service takes it from the account, so the app no
   * longer asks for it. Still accepted so older builds keep working.
   */
  @IsOptional()
  @IsString()
  phone?: string;

  /** Verified customer name, shown on the receipt. */
  @IsOptional()
  @IsString()
  customerName?: string;

  /** Which wallet pays: the main wallet (default) or the cashback wallet. */
  @IsOptional()
  @IsIn(['main', 'cashback'])
  paymentSource?: 'main' | 'cashback';
}
