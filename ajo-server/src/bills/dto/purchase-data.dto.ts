import { IsDefined, IsIn, IsOptional, IsString } from 'class-validator';

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

  /** Which wallet pays: the main wallet (default) or the cashback wallet. */
  @IsOptional()
  @IsIn(['main', 'cashback'])
  paymentSource?: 'main' | 'cashback';
}
