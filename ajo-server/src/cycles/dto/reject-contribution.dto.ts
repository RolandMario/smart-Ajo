import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /groups/:groupId/contributions/:contributionId/reject`.
 * The reason is shown to the member in the rejection notification.
 */
export class RejectContributionDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
