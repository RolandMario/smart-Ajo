import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DonationAmountType,
  DonationFrequency,
  DonationSchedule,
} from '../../common/enums/donation.enum';
import {
  DONATION_MAX_AMOUNT,
  DONATION_MIN_AMOUNT,
} from '../donation.constants';

/**
 * Payload for creating a donation pool ("pool collection").
 *
 * `amount` is required for FIXED pools and ignored for FREE_WILL pools.
 * `frequency` is required for INTERVAL pools and ignored for ONE_TIME pools;
 * both cross-field rules are enforced in `DonationsService.createGroup` so
 * the error messages mention the right field.
 */
export class CreateDonationGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  purpose!: string;

  @IsEnum(DonationAmountType)
  amountType!: DonationAmountType;

  /** Required when `amountType` is FIXED. */
  @IsOptional()
  @IsInt()
  @Min(DONATION_MIN_AMOUNT)
  @Max(DONATION_MAX_AMOUNT)
  amount?: number;

  @IsEnum(DonationSchedule)
  schedule!: DonationSchedule;

  /** Required when `schedule` is INTERVAL. */
  @IsOptional()
  @IsEnum(DonationFrequency)
  frequency?: DonationFrequency;
}
