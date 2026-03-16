import {
  IsString,
  IsArray,
  IsOptional,
  IsIn,
} from 'class-validator';

const SUPPORTED_PLATFORMS = ['linkedin', 'instagram', 'facebook', 'twitter', 'tiktok'];

export class CreateProposalDto {
  @IsOptional()
  @IsString()
  linkedinCompanyUrl?: string;

  @IsOptional()
  @IsArray()
  @IsIn(SUPPORTED_PLATFORMS, { each: true })
  platforms?: string[];

  // Facebook (URL completa de página o perfil)
  @IsOptional()
  @IsString()
  facebookUrl?: string;

  // facebookType ya no es necesario — el scraper auto-detecta desde la URL
  @IsOptional()
  facebookType?: 'page' | 'profile';

  // Instagram (username, @username o URL completa de perfil)
  @IsOptional()
  @IsString()
  instagramHandle?: string;

  // TikTok (username, @username o URL completa de perfil)
  @IsOptional()
  @IsString()
  tiktokHandle?: string;

  // Twitter/X (username, @username o URL completa de perfil)
  @IsOptional()
  @IsString()
  twitterHandle?: string;

  // Nombre de empresa (override manual, útil cuando no se pone LinkedIn URL)
  @IsOptional()
  @IsString()
  companyName?: string;
}
