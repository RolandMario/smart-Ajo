import {
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PurchaseAirtimeDto {
  /** VTpass airtime limits: ₦50 minimum, ₦50,000 maximum, whole naira only. */
  @IsDefined()
  @IsNumber()
  @IsInt()
  @Min(50)
  @Max(50_000)
  amount!: number;

  @IsDefined()
  @IsString()
  phone!: string;

  @IsDefined()
  @IsIn(['mtn', 'glo', 'airtel', '9mobile'])
  network!: string;

  /** Which wallet pays: the main wallet (default) or the cashback wallet. */
  @IsOptional()
  @IsIn(['main', 'cashback'])
  paymentSource?: 'main' | 'cashback';
}
