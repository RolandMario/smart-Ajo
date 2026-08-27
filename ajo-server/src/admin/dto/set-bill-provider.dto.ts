import { IsEnum } from 'class-validator';

export class SetBillProviderDto {
  @IsEnum(['vtpass', 'gladtidings'], {
    message: 'provider must be "vtpass" or "gladtidings"',
  })
  provider!: 'vtpass' | 'gladtidings';
}
