import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { MetaConnector } from './connectors/meta.connector';
import { TikTokConnector } from './connectors/tiktok.connector';
import { TikTokOAuthController } from './connectors/tiktok-oauth.controller';

@Module({
  imports: [ConfigModule],
  controllers: [CreatorsController, TikTokOAuthController],
  providers: [CreatorsService, MetaConnector, TikTokConnector],
  exports: [CreatorsService],
})
export class CreatorsModule {}
