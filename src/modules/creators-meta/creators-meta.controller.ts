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
import { CreatorsMetaService } from './creators-meta.service';
import { SearchCreatorsMetaDto } from './dto/search-creators-meta.dto';

@Controller('creators-meta')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CreatorsMetaController {
  constructor(private readonly creatorsMetaService: CreatorsMetaService) {}

  @Get('search')
  async searchCreators(
    @Request() req,
    @Query() searchDto: SearchCreatorsMetaDto,
  ) {
    return this.creatorsMetaService.searchCreators(req.user.userId, searchDto);
  }

  @Get(':creatorId')
  async getCreatorProfile(
    @Param('creatorId') creatorId: string,
    @Query('platform') platform?: 'facebook' | 'instagram',
  ) {
    return this.creatorsMetaService.getCreatorProfile(
      creatorId,
      platform || 'facebook',
    );
  }
}
