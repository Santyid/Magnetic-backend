import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'INVALID_EMAIL' })
  @IsNotEmpty()
  email: string;
}
