import { IsBoolean } from 'class-validator';

export class SetAutoCollectDto {
  @IsBoolean()
  enabled!: boolean;
}