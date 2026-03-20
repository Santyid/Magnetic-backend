import { Controller, Post, Get, Param, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProposalsService } from './proposals.service';
import { CreateDemoProposalDto } from './dto/create-demo-proposal.dto';

@Controller('demo/proposals')
export class DemoProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  async create(@Body() dto: CreateDemoProposalDto, @Req() req: Request) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '0.0.0.0';
    const proposal = await this.proposalsService.createDemo(dto, ip);
    return { id: proposal.id, status: proposal.status };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.proposalsService.findOneDemo(id);
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.proposalsService.getDemoStatus(id);
  }
}
