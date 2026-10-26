import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Payload for joining a pool. `groupId` is the short, shareable Group ID
 * (joinCode) the admin copied from the pool screen — case and stray dashes
 * are normalised server-side, so `ajo-7k3qp2` works too.
 */
export class JoinDonationGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  groupId!: string;
}
