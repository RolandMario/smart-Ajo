import { IsDefined, IsIn, IsNumber, IsString, Min } from 'class-validator';

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
}
