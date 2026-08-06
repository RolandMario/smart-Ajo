import { IsDefined, IsIn, IsString } from 'class-validator';

export class ValidateMeterDto {
  @IsDefined()
  @IsString()
  disco!: string;

  @IsDefined()
  @IsString()
  meterNumber!: string;

  @IsDefined()
  @IsIn(['prepaid', 'postpaid'])
  meterType!: 'prepaid' | 'postpaid';
}

export class ValidateSmartCardDto {
  @IsDefined()
  @IsIn(['dstv', 'gotv', 'startimes'])
  serviceProvider!: string;

  @IsDefined()
  @IsString()
  smartCardNumber!: string;
}
