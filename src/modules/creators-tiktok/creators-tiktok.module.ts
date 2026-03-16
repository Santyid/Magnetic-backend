import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsTikTokController } from './creators-tiktok.controller';
import { CreatorsTikTokService } from './creators-tiktok.service';
import { TikTokConnector } from './connectors/tiktok.connector';
import { TikTokOAuthController } from './connectors/tiktok-oauth.controller';
import { Creator } from '../../common/entities/creator.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Creator])],
  controllers: [CreatorsTikTokController, TikTokOAuthController],
  providers: [CreatorsTikTokService, TikTokConnector],
  exports: [CreatorsTikTokService],
})
export class CreatorsTikTokModule {}
