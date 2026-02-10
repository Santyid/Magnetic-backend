import {
  Controller,
  Get,
  Query,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreatorsService } from './creators.service';
import { SearchCreatorsDto } from './dto/search-creators.dto';

@Controller('creators')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

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
    @Query('platform') platform?: 'facebook' | 'instagram',
  ) {
    return this.creatorsService.getCreatorProfile(creatorId, platform || 'facebook');
  }
}
