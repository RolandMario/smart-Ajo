import { IsNotEmpty, IsPhoneNumber, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsPhoneNumber('NG', { message: 'Enter a valid Nigerian phone number' })
  phone: string;

  @IsNotEmpty({ message: 'OTP code is required' })
  code: string;

  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  newPassword: string;
}
