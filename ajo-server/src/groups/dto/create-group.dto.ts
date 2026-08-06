import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ContributionFrequency,
  RotationMethod,
} from '../../common/enums/group.enum';

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsNumber()
  @Min(1)
  contributionAmount!: number;

  @IsOptional()
  @IsEnum(ContributionFrequency)
  frequency?: ContributionFrequency;

  /**
   * Total number of members in the group, INCLUDING the admin
   * (the creator counts as the first slot).
   */
  @IsInt()
  @Min(2)
  @Max(200)
  totalSlots!: number;

  @IsEnum(RotationMethod)
  rotationMethod!: RotationMethod;
}
