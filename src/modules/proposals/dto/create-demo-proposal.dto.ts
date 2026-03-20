import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDemoProposalDto {
  @IsString()
  @IsNotEmpty()
  linkedinCompanyUrl: string;
}
