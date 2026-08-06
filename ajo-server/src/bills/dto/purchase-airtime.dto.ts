import { IsDefined, IsEnum, IsIn, IsNumber, IsString, Min } from 'class-validator';

export class PurchaseAirtimeDto {
  @IsDefined()
  @IsNumber()
  @Min(10)
  amount!: number;

  @IsDefined()
  @IsString()
  phone!: string;

  @IsDefined()
  @IsIn(['mtn', 'glo', 'airtel', '9mobile'])
  network!: string;
}
