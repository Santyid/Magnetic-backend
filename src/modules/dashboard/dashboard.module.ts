import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AdvocatesConnector } from './connectors/advocates.connector';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [DashboardController],
  providers: [DashboardService, AdvocatesConnector],
})
export class DashboardModule {}
