import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreatorsMetaController } from './creators-meta.controller';
import { CreatorsMetaService } from './creators-meta.service';
import { MetaConnector } from './connectors/meta.connector';

@Module({
  imports: [ConfigModule],
  controllers: [CreatorsMetaController],
  providers: [CreatorsMetaService, MetaConnector],
  exports: [CreatorsMetaService],
})
export class CreatorsMetaModule {}
