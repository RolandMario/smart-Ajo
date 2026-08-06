import { IsString, Length, MinLength } from 'class-validator';

export class SetBankAccountDto {
  /** 10-digit NUBAN account number. */
  @IsString()
  @Length(10, 10)
  accountNumber!: string;

  /** Paystack bank code, from GET /wallet/banks. */
  @IsString()
  @MinLength(1)
  bankCode!: string;

  /** Display name of the bank, from GET /wallet/banks (e.g. "Guaranty Trust Bank"). */
  @IsString()
  @MinLength(2)
  bankName!: string;
}
