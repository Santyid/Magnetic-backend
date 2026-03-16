import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { MetaConnector } from './connectors/meta.connector';
import { SearchCreatorsMetaDto } from './dto/search-creators-meta.dto';
import type {
  CreatorProfile,
  CreatorSearchResult,
} from '../../common/interfaces/creator.interface';

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CreatorsMetaService {
  private readonly logger = new Logger(CreatorsMetaService.name);
  private searchCache = new Map<string, CacheEntry<CreatorSearchResult>>();
  private profileCache = new Map<string, CacheEntry<CreatorProfile>>();
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
  private readonly RATE_LIMIT = 100;
  private readonly SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private metaConnector: MetaConnector) {}

  // ─── Rate Limiting ──────────────────────────────────────────

  private checkRateLimit(userId: string): void {
    const now = new Date();
    const key = `${userId}:meta`;
    const entry = this.rateLimitMap.get(key);

    if (!entry) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + this.RATE_LIMIT_WINDOW),
      });
      return;
    }

    if (now >= entry.resetAt) {
      this.rateLimitMap.set(key, {
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

  // ─── Search ─────────────────────────────────────────────────

  async searchCreators(
    userId: string,
    params: SearchCreatorsMetaDto,
  ): Promise<CreatorSearchResult> {
    const platform = params.platform || 'facebook';

    this.checkRateLimit(userId);

    const limit = params.limit || 20;
    const cacheKey = `search:${platform}:${params.q}:${limit}:${params.cursor || ''}`;

    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const result = await this.metaConnector.searchCreators(
        params.q,
        platform,
        limit,
        params.cursor,
      );

      this.searchCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + this.SEARCH_CACHE_TTL,
      });

      return result;
    } catch (error) {
      this.logger.error(`Search creators failed: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 502,
          message: 'META_API_ERROR',
          error: error.message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ─── Profile ────────────────────────────────────────────────

  async getCreatorProfile(
    creatorId: string,
    platform: 'facebook' | 'instagram' = 'facebook',
  ): Promise<CreatorProfile> {
    const cacheKey = `profile:${platform}:${creatorId}`;

    const cached = this.profileCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const profile = await this.metaConnector.getCreatorProfile(
        creatorId,
        platform,
      );

      this.profileCache.set(cacheKey, {
        data: profile,
        expiresAt: Date.now() + this.PROFILE_CACHE_TTL,
      });

      return profile;
    } catch (error) {
      this.logger.error(
        `Get creator profile failed for ${creatorId}: ${error.message}`,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 502,
          message: 'META_API_ERROR',
          error: error.message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
