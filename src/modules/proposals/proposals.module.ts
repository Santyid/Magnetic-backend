import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProposalsController } from './proposals.controller';
import { DemoProposalsController } from './demo-proposals.controller';
import { ProposalsService } from './proposals.service';
import { AnalysisService } from './analysis.service';
import { LinkedInScraper } from './scrapers/linkedin.scraper';
import { FacebookScraper } from './scrapers/facebook.scraper';
import { InstagramScraper } from './scrapers/instagram.scraper';
import { TikTokScraper } from './scrapers/tiktok.scraper';
import { TwitterScraper } from './scrapers/twitter.scraper';
import { Proposal } from './entities/proposal.entity';
import { ProposalCompany } from './entities/proposal-company.entity';
import { ProposalEmployee } from './entities/proposal-employee.entity';
import { ProposalProjection } from './entities/proposal-projection.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    ConfigModule,
    AiModule,
    TypeOrmModule.forFeature([Proposal, ProposalCompany, ProposalEmployee, ProposalProjection]),
  ],
  controllers: [ProposalsController, DemoProposalsController],
  providers: [ProposalsService, AnalysisService, LinkedInScraper, FacebookScraper, InstagramScraper, TikTokScraper, TwitterScraper],
})
export class ProposalsModule {}
