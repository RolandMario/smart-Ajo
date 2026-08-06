import { IsPhoneNumber } from 'class-validator';

export class ForgotPasswordDto {
  @IsPhoneNumber('NG', { message: 'Enter a valid Nigerian phone number' })
  phone: string;
}
