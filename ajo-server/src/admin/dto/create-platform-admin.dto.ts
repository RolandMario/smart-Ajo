import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { E164_REGEX } from '../../common/constants/regex';

export class CreatePlatformAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(E164_REGEX, {
    message:
      'phone must be a valid E.164 formatted number, e.g. +2348012345678',
  })
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
