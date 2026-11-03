import {
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Body of `POST /bills/cable/renew`. Only the decoder is sent: the server asks
 * VTpass what the current bouquet is and what the renewal costs, so the member
 * never has to re-pick a plan (and cannot be charged for a different one).
 */
export class RenewCableDto {
  @IsDefined()
  @IsIn(['dstv', 'gotv', 'startimes'])
  serviceProvider!: string;

  @IsDefined()
  @IsString()
  smartCardNumber!: string;

  /** Verified subscriber name, shown on the receipt. */
  @IsOptional()
  @IsString()
  customerName?: string;

  /**
   * The amount the member was shown. Optional, but when present and VTpass now
   * bills a different figure (a re-price landed between verify and pay) the
   * renewal is rejected instead of debiting an amount the member never saw.
   */
  @IsOptional()
  @IsNumber()
  expectedAmount?: number;

  /** Which wallet pays: the main wallet (default) or the cashback wallet. */
  @IsOptional()
  @IsIn(['main', 'cashback'])
  paymentSource?: 'main' | 'cashback';
}
