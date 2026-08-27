import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ContributionFrequency } from '../../common/enums/group.enum';
import { SavingDurationUnit } from '../../common/enums/saving.enum';

/**
 * Payload for creating an individual savings plan.
 *
 * `durationUnit` + `durationValue` define the cycle length, measured from the
 * day the plan is created — e.g. days + 20 => 20 days, months + 2 => 2 months.
 * The server derives the number of intervals from (frequency, durationUnit,
 * durationValue).
 */
export class CreateSavingPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(ContributionFrequency)
  frequency!: ContributionFrequency;

  @IsEnum(SavingDurationUnit)
  durationUnit!: SavingDurationUnit;

  @IsInt()
  @Min(1)
  durationValue!: number;
}
