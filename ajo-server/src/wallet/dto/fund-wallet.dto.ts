import { IsNumber, Min } from 'class-validator';

export class FundWalletDto {
  /** Amount in naira (major unit). */
  @IsNumber()
  @Min(100)
  amount!: number;
}
