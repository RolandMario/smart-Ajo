import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreditWalletDto {
  /** Amount in naira (major unit) to credit the user's wallet. */
  @IsNumber()
  @Min(1)
  amount!: number;

  /** Optional note recorded in the wallet ledger for audit. */
  @IsOptional()
  @IsString()
  note?: string;
}
