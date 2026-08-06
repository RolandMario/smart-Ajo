import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { GroupWalletTransactionType } from '../../common/enums/wallet.enum';

export class ListGroupWalletTransactionsQueryDto {
  @IsOptional()
  @IsEnum(GroupWalletTransactionType)
  type?: GroupWalletTransactionType;

  /** Filter to a single group's ledger (e.g. from the group detail page). */
  @IsOptional()
  @IsMongoId()
  groupId?: string;

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
