import { IsOptional, IsInt, Min, Max, IsEnum, IsNumber } from 'class-validator';
import { ContributionFrequency } from '../../common/enums/group.enum';

export class ContinueGroupDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  contributionAmount?: number;

  @IsOptional()
  @IsEnum(ContributionFrequency)
  frequency?: ContributionFrequency;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(200)
  totalSlots?: number;
}
