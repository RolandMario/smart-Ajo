import { IsInt, Min } from 'class-validator';

export class WithdrawAdminWalletDto {
  @IsInt()
  @Min(1)
  amount!: number;
}