import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreatorsService } from './creators.service';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { SyncCreatorsDto } from './dto/sync-creators.dto';

@Controller('creators')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post('sync')
  async syncCreators(@Body() syncDto: SyncCreatorsDto) {
    return this.creatorsService.syncCreators(
      syncDto.keywords,
      syncDto.platform || 'tiktok',
      syncDto.maxPagesPerKeyword || 2,
    );
  }

  @Get('sync/stats')
  async getSyncStats() {
    return this.creatorsService.getSyncStats();
  }

  @Get('search')
  async searchCreators(
    @Request() req,
    @Query() searchDto: SearchCreatorsDto,
  ) {
    return this.creatorsService.searchCreators(req.user.userId, searchDto);
  }

  @Get(':creatorId')
  async getCreatorProfile(
    @Param('creatorId') creatorId: string,
    @Query('platform') platform?: 'facebook' | 'instagram' | 'tiktok',
  ) {
    return this.creatorsService.getCreatorProfile(
      creatorId,
      platform || 'facebook',
    );
  }
}
