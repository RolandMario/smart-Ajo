import {
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class PurchaseCableDto {
  @IsDefined()
  @IsIn(['dstv', 'gotv', 'startimes'])
  serviceProvider!: string;

  @IsDefined()
  @IsString()
  smartCardNumber!: string;

  /**
   * Legacy field kept for the shipped mobile app (`forbidNonWhitelisted` would
   * otherwise start rejecting its payloads). The server prices every cable
   * purchase from its own catalogue and ignores whatever is sent here.
   */
  @IsOptional()
  @IsNumber()
  amount?: number;

  /**
   * The selected bouquet code (e.g. `dstv-compact`). Required by VTpass, and
   * the only thing that decides what the member is charged.
   */
  @IsDefined()
  @IsString()
  variationCode!: string;

  /** Verified subscriber name, shown on the receipt. */
  @IsOptional()
  @IsString()
  customerName?: string;

  /** Which wallet pays: the main wallet (default) or the cashback wallet. */
  @IsOptional()
  @IsIn(['main', 'cashback'])
  paymentSource?: 'main' | 'cashback';
}
