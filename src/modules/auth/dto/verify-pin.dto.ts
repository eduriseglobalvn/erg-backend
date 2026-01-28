import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyPinDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Mã PIN phải có đúng 6 ký tự' })
  pin!: string;
}

export class ResendPinDto {
  @IsString()
  @IsNotEmpty()
  email!: string;
}