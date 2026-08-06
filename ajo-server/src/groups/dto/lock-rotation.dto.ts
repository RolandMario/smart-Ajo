import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsOptional,
} from 'class-validator';

export class LockRotationDto {
  /**
   * Required when the group's rotationMethod is MANUAL.
   * Must contain the GroupMember id of every ACCEPTED member, in the
   * exact payout order desired (first id collects in cycle 1, etc.).
   * Ignored (and not required) when rotationMethod is RANDOM.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsMongoId({ each: true })
  order?: string[];
}
