import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
} from '../donation.constants';

/**
 * Payload for donating into a pool.
 *
 * `amount` is required for FREE_WILL pools and must be omitted (or equal to
 * the pool amount) for FIXED ones — the server enforces that so a client bug
 * can never over/under-charge a fixed pool.
 */
export class DonateDto {
  @IsOptional()
  @IsInt()
  @Min(DONATION_MIN_AMOUNT)
  @Max(DONATION_MAX_AMOUNT)
  amount?: number;
}
