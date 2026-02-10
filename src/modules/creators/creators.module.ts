import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { MetaConnector } from './connectors/meta.connector';

@Module({
  imports: [ConfigModule],
  controllers: [CreatorsController],
  providers: [CreatorsService, MetaConnector],
  exports: [CreatorsService],
})
export class CreatorsModule {}
