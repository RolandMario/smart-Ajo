import { IsBoolean } from 'class-validator';

/**
 * Payload for the red/green termination switch on the pool screen.
 *
 * `vote: true` casts the caller's yes vote for terminating the pool,
 * `vote: false` withdraws it. Only members who have made 100% of their
 * payment towards the pool may vote — enforced in `DonationsService`.
 */
export class SetTerminationVoteDto {
  @IsBoolean()
  vote!: boolean;
}
