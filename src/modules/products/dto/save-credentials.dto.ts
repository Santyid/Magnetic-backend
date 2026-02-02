import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SaveCredentialsDto {
  @IsOptional()
  @IsString()
  productEmail?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;

  @IsOptional()
  @IsBoolean()
  enableMetrics?: boolean;
}
