import { IsDefined, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PurchaseCableDto {
  @IsDefined()
  @IsIn(['dstv', 'gotv', 'startimes'])
  serviceProvider!: string;

  @IsDefined()
  @IsString()
  smartCardNumber!: string;

  @IsDefined()
  @IsNumber()
  @Min(100)
  amount!: number;

  /** The selected bouquet/plan code (required by VTPass for cable vending). */
  @IsOptional()
  @IsString()
  variationCode?: string;
}
