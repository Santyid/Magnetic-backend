import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class AssignProductDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  externalUserId: string;

  @IsString()
  @IsOptional()
  customDomain?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
