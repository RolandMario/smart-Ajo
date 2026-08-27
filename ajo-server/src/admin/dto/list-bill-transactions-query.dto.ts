import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

/**
 * Query for the platform-admin bill transactions ledger
 * (`GET /admin/bills/transactions`). Lets an admin view every bill purchase
 * on the platform and filter by service category, status, or a single user.
 */
export class ListBillTransactionsQueryDto {
  @IsOptional()
  @IsIn(['airtime', 'data', 'cable', 'electricity'])
  serviceType?: string;

  @IsOptional()
  @IsIn(['pending', 'success', 'failed'])
  status?: string;

  /** Filter to a single user's bill transactions (e.g. from support flows). */
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
