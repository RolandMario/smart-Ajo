import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/**
 * Admin-only: choose where a pool's escrow is paid out.
 *
 * Two mutually exclusive shapes, validated in the service:
 *
 *   { useAdminAccount: true }                          -> clear the pool
 *       override and fall back to the admin's own saved bank account.
 *   { bankName, bankCode, accountNumber }               -> resolve the NUBAN
 *       via Paystack, create a transfer recipient and store it on the pool.
 */
export class SetDonationPayoutAccountDto {
  @IsOptional()
  @IsBoolean()
  useAdminAccount?: boolean;

  /** 10-digit NUBAN account number. */
  @IsOptional()
  @IsString()
  @Length(10, 10)
  accountNumber?: string;

  /** Paystack bank code, from GET /wallet/banks. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  bankCode?: string;

  /** Display name of the bank, from GET /wallet/banks. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  bankName?: string;
}
