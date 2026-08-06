import { IsDefined, IsIn, IsString } from 'class-validator';

export class PurchaseDataDto {
  @IsDefined()
  @IsIn(['mtn', 'glo', 'airtel', '9mobile'])
  network!: string;

  @IsDefined()
  @IsString()
  phone!: string;

  @IsDefined()
  @IsString()
  dataPlanId!: string;
}
