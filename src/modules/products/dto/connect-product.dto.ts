import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ConnectProductDto {
  @IsString()
  @IsNotEmpty()
  productEmail: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsString()
  subdomain?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;
}
