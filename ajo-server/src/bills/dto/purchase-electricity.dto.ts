import { IsDefined, IsEnum, IsNumber, IsString, Min } from 'class-validator';

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
}
