import { IsOptional, IsString, IsInt, Min, Max, IsEnum, MinLength } from 'class-validator';
import { ContributionFrequency } from '../../common/enums/group.enum';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsInt()
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