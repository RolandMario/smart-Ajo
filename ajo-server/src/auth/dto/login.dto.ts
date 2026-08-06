import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class LoginDto {
  @IsPhoneNumber('NG', { message: 'Enter a valid Nigerian phone number' })
  phone: string;

  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
