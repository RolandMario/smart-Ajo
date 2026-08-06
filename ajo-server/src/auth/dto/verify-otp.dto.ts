import { IsString, Length, Matches } from 'class-validator';
import { E164_REGEX } from '../../common/constants/regex';

export class VerifyOtpDto {
  @IsString()
  @Matches(E164_REGEX, {
    message:
      'phone must be a valid E.164 formatted number, e.g. +2348012345678',
  })
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}
