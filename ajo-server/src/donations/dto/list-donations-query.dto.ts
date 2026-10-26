import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DONATION_MAX_PAGE_SIZE } from '../donation.constants';

/** Query params for the pool donation history and payout history. */
export class ListDonationsQueryDto {
  /** 1-based page number. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Rows per page (capped at `DONATION_MAX_PAGE_SIZE`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DONATION_MAX_PAGE_SIZE)
  limit?: number = 10;
}
