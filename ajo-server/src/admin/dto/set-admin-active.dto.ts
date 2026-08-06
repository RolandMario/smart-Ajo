import { IsBoolean } from 'class-validator';

export class SetAdminActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
