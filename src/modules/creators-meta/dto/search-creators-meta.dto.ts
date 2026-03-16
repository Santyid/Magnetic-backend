import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchCreatorsMetaDto {
  @IsString()
  q: string;

  @IsOptional()
  @IsIn(['facebook', 'instagram'])
  platform?: 'facebook' | 'instagram' = 'facebook';

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}
