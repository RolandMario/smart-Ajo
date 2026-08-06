import { IsString, Matches } from 'class-validator';
import { E164_REGEX } from '../../common/constants/regex';

export class RequestOtpDto {
  @IsString()
  @Matches(E164_REGEX, {
    message:
      'phone must be a valid E.164 formatted number, e.g. +2348012345678',
  })
  phone!: string;
}
