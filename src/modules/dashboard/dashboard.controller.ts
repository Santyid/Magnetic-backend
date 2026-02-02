import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConnectProductDto } from '../products/dto/connect-product.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post('connect/:userProductId')
  async connectProduct(
    @Request() req,
    @Param('userProductId') userProductId: string,
    @Body() connectProductDto: ConnectProductDto,
  ) {
    return this.dashboardService.connectProduct(
      req.user.userId,
      userProductId,
      connectProductDto,
    );
  }

  @Delete('connect/:userProductId')
  async disconnectProduct(
    @Request() req,
    @Param('userProductId') userProductId: string,
  ) {
    return this.dashboardService.disconnectProduct(
      req.user.userId,
      userProductId,
    );
  }

  @Get('metrics')
  async getMetrics(@Request() req) {
    return this.dashboardService.getMetrics(req.user.userId);
  }

  @Post('sync/:userProductId')
  async syncProduct(
    @Request() req,
    @Param('userProductId') userProductId: string,
  ) {
    return this.dashboardService.syncProduct(req.user.userId, userProductId);
  }
}
