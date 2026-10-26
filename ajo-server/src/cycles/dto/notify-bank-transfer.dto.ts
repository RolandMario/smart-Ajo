import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /groups/:groupId/contributions/:contributionId/notify-transfer`.
 * `claimedReference` is optional — whatever the member sees on their bank
 * receipt, which helps the group admin reconcile the escrow credit.
 */
export class NotifyBankTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  claimedReference?: string;
}
