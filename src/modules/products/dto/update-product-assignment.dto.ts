import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class UpdateProductAssignmentDto {
  @IsString()
  @IsOptional()
  externalUserId?: string;

  @IsString()
  @IsOptional()
  customDomain?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
