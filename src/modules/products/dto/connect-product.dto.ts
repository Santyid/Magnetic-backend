import { IsString, IsOptional } from 'class-validator';

export class ConnectProductDto {
  @IsString()
  productEmail: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  subdomain?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;
}
