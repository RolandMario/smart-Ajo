import { IsBoolean } from 'class-validator';

export class SetBillPlanActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
