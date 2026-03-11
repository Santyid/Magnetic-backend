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
import { CreatorsTikTokService } from './creators-tiktok.service';
import { SearchCreatorsTikTokDto } from './dto/search-creators-tiktok.dto';
import { SyncCreatorsDto } from './dto/sync-creators.dto';

@Controller('creators-tiktok')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CreatorsTikTokController {
  constructor(private readonly creatorsTikTokService: CreatorsTikTokService) {}

  @Post('sync')
  async syncCreators(@Body() syncDto: SyncCreatorsDto) {
    return this.creatorsTikTokService.syncCreators(
      syncDto.keywords,
      syncDto.maxPagesPerKeyword || 2,
    );
  }

  @Get('sync/stats')
  async getSyncStats() {
    return this.creatorsTikTokService.getSyncStats();
  }

  @Get('search')
  async searchCreators(
    @Request() req,
    @Query() searchDto: SearchCreatorsTikTokDto,
  ) {
    return this.creatorsTikTokService.searchCreators(req.user.userId, searchDto);
  }

  @Get(':creatorId')
  async getCreatorProfile(@Param('creatorId') creatorId: string) {
    return this.creatorsTikTokService.getCreatorProfile(creatorId);
  }
}
