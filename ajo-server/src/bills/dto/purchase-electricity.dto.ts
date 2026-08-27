import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PurchaseElectricityDto {
  @IsDefined()
  @IsString()
  disco!: string;

  @IsDefined()
  @IsString()
  meterNumber!: string;

  @IsDefined()
  @IsEnum(['prepaid', 'postpaid'])
  meterType!: 'prepaid' | 'postpaid';

  @IsDefined()
  @IsNumber()
  @Min(100)
  amount!: number;

  @IsDefined()
  @IsString()
  phone!: string;

  /** Verified customer name, shown on the receipt. */
  @IsOptional()
  @IsString()
  customerName?: string;
}
