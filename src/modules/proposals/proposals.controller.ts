import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';

const imageCache = new Map<string, { data: Buffer; contentType: string; expiresAt: number }>();
const inFlight = new Map<string, Promise<{ data: Buffer; contentType: string }>>();

async function fetchAndConvert(url: string): Promise<{ data: Buffer; contentType: string }> {
  const isTikTok = url.includes('tiktok');
  const isFacebook = url.includes('fbcdn.net');
  const isTwitter = url.includes('twimg.com');
  const referer = isTikTok
    ? 'https://www.tiktok.com/'
    : isFacebook
      ? 'https://www.facebook.com/'
      : isTwitter
        ? 'https://twitter.com/'
        : 'https://www.instagram.com/';
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: referer,
    },
    timeout: 20000,
  });
  const contentType = response.headers['content-type'] ?? 'image/jpeg';
  if (contentType.includes('heic') || contentType.includes('avif')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const convert = require('heic-convert');
    const jpeg = Buffer.from(await convert({ buffer: Buffer.from(response.data), format: 'JPEG', quality: 0.85 }));
    return { data: jpeg, contentType: 'image/jpeg' };
  }
  return { data: Buffer.from(response.data), contentType };
}

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Request() req, @Body() dto: CreateProposalDto) {
    return this.proposalsService.create(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll(@Request() req) {
    return this.proposalsService.findAll(req.user.id);
  }

  @Get('image-proxy')
  async imageProxy(@Query('url') url: string, @Res() res: Response) {
    if (!url) throw new BadRequestException('Missing url');
    const allowed = ['cdninstagram.com', 'licdn.com', 'media.licdn.com', 'tiktokcdn-eu.com', 'tiktokcdn.com', 'fbcdn.net', 'twimg.com'];
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid url');
    }
    if (!allowed.some((h) => parsed.hostname.endsWith(h))) {
      throw new BadRequestException('URL not allowed');
    }

    // Serve from cache if available
    const cached = imageCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Content-Type', cached.contentType);
      return res.send(cached.data);
    }

    // Deduplicate in-flight requests for the same URL
    let promise = inFlight.get(url);
    if (!promise) {
      promise = fetchAndConvert(url).then((result) => {
        imageCache.set(url, { ...result, expiresAt: Date.now() + 86400_000 });
        inFlight.delete(url);
        return result;
      }).catch((err) => {
        inFlight.delete(url);
        throw err;
      });
      inFlight.set(url, promise);
    }

    try {
      const { data, contentType } = await promise;
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Content-Type', contentType);
      return res.send(data);
    } catch {
      throw new InternalServerErrorException('Failed to fetch image');
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findOne(@Param('id') id: string, @Request() req) {
    return this.proposalsService.findOne(id, req.user.id);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getStatus(@Param('id') id: string, @Request() req) {
    return this.proposalsService.getStatus(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string, @Request() req) {
    return this.proposalsService.remove(id, req.user.id);
  }

  @Post(':id/ai-analysis')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getAiAnalysis(@Param('id') id: string, @Request() req) {
    return this.proposalsService.getAiAnalysis(id, req.user.id);
  }
}
