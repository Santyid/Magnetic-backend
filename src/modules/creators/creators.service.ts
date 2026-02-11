import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { MetaConnector } from './connectors/meta.connector';
import { TikTokConnector } from './connectors/tiktok.connector';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import type {
  CreatorProfile,
  CreatorSearchResult,
} from './interfaces/creator.interface';

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CreatorsService {
  private readonly logger = new Logger(CreatorsService.name);
  private searchCache = new Map<string, CacheEntry<CreatorSearchResult>>();
  private profileCache = new Map<string, CacheEntry<CreatorProfile>>();
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT = 100; // searches per hour
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private metaConnector: MetaConnector,
    private tiktokConnector: TikTokConnector,
  ) {}

  private checkRateLimit(userId: string): void {
    const now = new Date();
    const entry = this.rateLimitMap.get(userId);

    if (!entry) {
      this.rateLimitMap.set(userId, {
        count: 1,
        resetAt: new Date(now.getTime() + this.RATE_LIMIT_WINDOW),
      });
      return;
    }

    if (now >= entry.resetAt) {
      this.rateLimitMap.set(userId, {
        count: 1,
        resetAt: new Date(now.getTime() + this.RATE_LIMIT_WINDOW),
      });
      return;
    }

    if (entry.count >= this.RATE_LIMIT) {
      const secondsUntilReset = Math.ceil(
        (entry.resetAt.getTime() - now.getTime()) / 1000,
      );
      throw new HttpException(
        {
          statusCode: 429,
          message: 'CREATORS_RATE_LIMIT_EXCEEDED',
          retryAfter: secondsUntilReset,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
  }

  async searchCreators(
    userId: string,
    params: SearchCreatorsDto,
  ): Promise<CreatorSearchResult> {
    this.checkRateLimit(userId);

    const limit = params.limit || 20;
    const platform = params.platform || 'facebook';
    const cacheKey = `search:${platform}:${params.q}:${limit}:${params.cursor || ''}`;

    // Check cache
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      let result: CreatorSearchResult;

      if (platform === 'tiktok') {
        result = await this.tiktokConnector.searchCreators(
          params.q,
          limit,
          params.cursor,
        );
      } else {
        result = await this.metaConnector.searchCreators(
          params.q,
          platform,
          limit,
          params.cursor,
        );
      }

      // Cache result
      this.searchCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return result;
    } catch (error) {
      this.logger.error(`Search creators failed: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      const errorCode =
        platform === 'tiktok' ? 'TIKTOK_API_ERROR' : 'META_API_ERROR';

      throw new HttpException(
        {
          statusCode: 502,
          message: errorCode,
          error: error.message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getCreatorProfile(
    creatorId: string,
    platform: 'facebook' | 'instagram' | 'tiktok' = 'facebook',
  ): Promise<CreatorProfile> {
    const cacheKey = `profile:${platform}:${creatorId}`;

    const cached = this.profileCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      let profile: CreatorProfile;

      if (platform === 'tiktok') {
        profile = await this.tiktokConnector.getCreatorProfile(creatorId);
      } else {
        profile = await this.metaConnector.getCreatorProfile(
          creatorId,
          platform,
        );
      }

      this.profileCache.set(cacheKey, {
        data: profile,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return profile;
    } catch (error) {
      this.logger.error(
        `Get creator profile failed for ${creatorId}: ${error.message}`,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      const errorCode =
        platform === 'tiktok' ? 'TIKTOK_API_ERROR' : 'META_API_ERROR';

      throw new HttpException(
        {
          statusCode: 502,
          message: errorCode,
          error: error.message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
