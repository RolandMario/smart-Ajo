import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsPhoneNumber('NG', { message: 'Enter a valid Nigerian phone number' })
  phone: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;
}
