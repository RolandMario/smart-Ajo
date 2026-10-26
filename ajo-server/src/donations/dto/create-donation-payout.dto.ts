import { IsInt, IsOptional, Min } from 'class-validator';
import { DONATION_PAYOUT_MIN_AMOUNT } from '../donation.constants';

/**
 * Payload for an admin payout. Omit `amount` to withdraw the entire escrow
 * balance; pass a smaller value to leave money in the pool.
 */
export class CreateDonationPayoutDto {
  @IsOptional()
  @IsInt()
  @Min(DONATION_PAYOUT_MIN_AMOUNT)
  amount?: number;
}
