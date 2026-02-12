import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, Brackets } from 'typeorm';
import { MetaConnector } from './connectors/meta.connector';
import { TikTokConnector } from './connectors/tiktok.connector';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { Creator } from './entities/creator.entity';
import type {
  CreatorProfile,
  CreatorSearchResult,
  CreatorSummary,
} from './interfaces/creator.interface';

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface SyncResult {
  totalSynced: number;
  totalApiCalls: number;
  totalCreatorsInDb: number;
  keywords: string[];
  errors: string[];
  durationMs: number;
}

const DEFAULT_SYNC_KEYWORDS = [
  'beauty',
  'fitness',
  'food',
  'fashion',
  'gaming',
  'music',
  'comedy',
  'dance',
  'travel',
  'tech',
  'lifestyle',
  'sports',
  'health',
  'education',
  'pets',
  'cooking',
  'photography',
  'business',
  'motivation',
  'art',
];

@Injectable()
export class CreatorsService {
  private readonly logger = new Logger(CreatorsService.name);
  private searchCache = new Map<string, CacheEntry<CreatorSearchResult>>();
  private profileCache = new Map<string, CacheEntry<CreatorProfile>>();
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
  private readonly RATE_LIMITS: Record<string, number> = {
    tiktok: 20, // TikTok Basic plan — conserve API quota
    meta: 100,
  };
  private readonly SEARCH_CACHE_TTL: Record<string, number> = {
    tiktok: 30 * 60 * 1000, // 30 minutes
    meta: 5 * 60 * 1000, // 5 minutes
  };
  private readonly PROFILE_CACHE_TTL: Record<string, number> = {
    tiktok: 2 * 60 * 60 * 1000, // 2 hours
    meta: 5 * 60 * 1000, // 5 minutes
  };

  constructor(
    @InjectRepository(Creator)
    private creatorRepo: Repository<Creator>,
    private metaConnector: MetaConnector,
    private tiktokConnector: TikTokConnector,
  ) {}

  // ─── Rate Limiting ──────────────────────────────────────────

  private checkRateLimit(userId: string, platform: string): void {
    const now = new Date();
    const key = `${userId}:${platform}`;
    const limit = this.RATE_LIMITS[platform] || this.RATE_LIMITS.meta;
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

    if (entry.count >= limit) {
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

  // ─── Sync (TikTok → PostgreSQL) ────────────────────────────

  async syncCreators(
    keywords?: string[],
    platform = 'tiktok',
    maxPagesPerKeyword = 2,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const kws =
      keywords && keywords.length > 0 ? keywords : DEFAULT_SYNC_KEYWORDS;

    let totalSynced = 0;
    let totalApiCalls = 0;
    const errors: string[] = [];

    this.logger.log(
      `Starting sync: ${kws.length} keywords, ${maxPagesPerKeyword} pages each`,
    );

    for (const keyword of kws) {
      for (let page = 1; page <= maxPagesPerKeyword; page++) {
        try {
          const result = await this.tiktokConnector.searchCreators(
            keyword,
            50,
            String(page),
          );
          totalApiCalls++;

          for (const creator of result.creators) {
            await this.upsertCreator(creator, platform, keyword);
            totalSynced++;
          }

          this.logger.log(
            `Synced "${keyword}" page ${page}: ${result.creators.length} creators`,
          );

          if (!result.paging.hasNextPage) break;

          // Delay between API calls to avoid rate limiting
          await this.delay(1500);
        } catch (error) {
          const msg = `${keyword} page ${page}: ${error.message}`;
          this.logger.warn(`Sync error: ${msg}`);
          errors.push(msg);
          break; // Skip to next keyword on error
        }
      }

      // Small delay between keywords
      await this.delay(500);
    }

    const totalCreatorsInDb = await this.creatorRepo.count({
      where: { platform },
    });

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `Sync complete: ${totalSynced} synced, ${totalApiCalls} API calls, ${totalCreatorsInDb} total in DB (${Math.round(durationMs / 1000)}s)`,
    );

    return {
      totalSynced,
      totalApiCalls,
      totalCreatorsInDb,
      keywords: kws,
      errors,
      durationMs,
    };
  }

  private async upsertCreator(
    summary: CreatorSummary,
    platform: string,
    keyword: string,
  ): Promise<void> {
    const existing = await this.creatorRepo.findOne({
      where: { platformId: summary.id, platform },
    });

    if (existing) {
      await this.creatorRepo.update(existing.id, {
        username: summary.username,
        name: summary.name,
        profilePictureUrl: summary.profilePictureUrl,
        followersCount: summary.followersCount,
        engagementRate: summary.engagementRate,
        categories: summary.categories || [],
        isVerified: summary.isVerified || false,
        syncKeyword: keyword,
        lastSyncedAt: new Date(),
      });
    } else {
      const creator = this.creatorRepo.create({
        platformId: summary.id,
        platform,
        username: summary.username,
        name: summary.name,
        profilePictureUrl: summary.profilePictureUrl,
        followersCount: summary.followersCount,
        engagementRate: summary.engagementRate,
        categories: summary.categories || [],
        isVerified: summary.isVerified || false,
        syncKeyword: keyword,
        lastSyncedAt: new Date(),
      });
      await this.creatorRepo.save(creator);
    }
  }

  // ─── Sync Stats ─────────────────────────────────────────────

  async getSyncStats(): Promise<{
    totalCreators: number;
    byPlatform: Record<string, number>;
    lastSyncAt: Date | null;
    oldestData: Date | null;
  }> {
    const totalCreators = await this.creatorRepo.count();

    const byPlatformRaw = await this.creatorRepo
      .createQueryBuilder('c')
      .select('c.platform', 'platform')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.platform')
      .getRawMany();

    const byPlatform: Record<string, number> = {};
    for (const row of byPlatformRaw) {
      byPlatform[row.platform] = parseInt(row.count, 10);
    }

    const newest = await this.creatorRepo.findOne({
      where: {},
      order: { lastSyncedAt: 'DESC' },
      select: ['lastSyncedAt'],
    });

    const oldest = await this.creatorRepo.findOne({
      where: {},
      order: { lastSyncedAt: 'ASC' },
      select: ['lastSyncedAt'],
    });

    return {
      totalCreators,
      byPlatform,
      lastSyncAt: newest?.lastSyncedAt || null,
      oldestData: oldest?.lastSyncedAt || null,
    };
  }

  // ─── Cron: Auto-sync diario a las 6 AM ──────────────────────

  @Cron('0 6 * * *')
  async handleDailySync(): Promise<void> {
    this.logger.log('Starting daily TikTok creators sync (cron 6 AM)...');
    try {
      const result = await this.syncCreators();
      this.logger.log(
        `Daily sync complete: ${result.totalSynced} synced, ${result.totalCreatorsInDb} total in DB (${Math.round(result.durationMs / 1000)}s)`,
      );
    } catch (error) {
      this.logger.error(`Daily sync failed: ${error.message}`);
    }
  }

  // ─── Search ─────────────────────────────────────────────────

  async searchCreators(
    userId: string,
    params: SearchCreatorsDto,
  ): Promise<CreatorSearchResult> {
    const platform = params.platform || 'facebook';

    // TikTok: search from local DB (no API calls)
    if (platform === 'tiktok') {
      return this.searchCreatorsFromDb(params.q, platform, params.limit || 20, params.cursor);
    }

    // Meta: search via API (existing behavior)
    this.checkRateLimit(userId, platform);

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

      const ttl =
        this.SEARCH_CACHE_TTL[platform] || this.SEARCH_CACHE_TTL.meta;
      this.searchCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + ttl,
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

  private async searchCreatorsFromDb(
    query: string,
    platform: string,
    limit: number,
    cursor?: string,
  ): Promise<CreatorSearchResult> {
    const offset = cursor ? parseInt(cursor, 10) || 0 : 0;

    const qb = this.creatorRepo
      .createQueryBuilder('creator')
      .where('creator.platform = :platform', { platform });

    if (query && query.trim()) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('creator.name ILIKE :q', { q: `%${query}%` })
            .orWhere('creator.username ILIKE :q', { q: `%${query}%` })
            .orWhere('creator.categories ILIKE :q', { q: `%${query}%` });
        }),
      );
    }

    qb.orderBy('creator.followersCount', 'DESC')
      .take(limit)
      .skip(offset);

    const [creators, total] = await qb.getManyAndCount();

    return {
      creators: creators.map((c) => this.entityToSummary(c)),
      paging: {
        cursors:
          offset + limit < total
            ? { after: String(offset + limit) }
            : undefined,
        hasNextPage: offset + limit < total,
      },
      totalCount: total,
    };
  }

  // ─── Profile ────────────────────────────────────────────────

  async getCreatorProfile(
    creatorId: string,
    platform: 'facebook' | 'instagram' | 'tiktok' = 'facebook',
  ): Promise<CreatorProfile> {
    // TikTok: check DB first, fall back to API
    if (platform === 'tiktok') {
      return this.getTikTokProfileFromDb(creatorId);
    }

    // Meta: use API with cache (existing behavior)
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

      const ttl =
        this.PROFILE_CACHE_TTL[platform] || this.PROFILE_CACHE_TTL.meta;
      this.profileCache.set(cacheKey, {
        data: profile,
        expiresAt: Date.now() + ttl,
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

  private async getTikTokProfileFromDb(
    creatorId: string,
  ): Promise<CreatorProfile> {
    // Check DB first
    const entity = await this.creatorRepo.findOne({
      where: { platformId: creatorId, platform: 'tiktok' },
    });

    if (entity && entity.biography !== null) {
      // We have profile data in DB
      return this.entityToProfile(entity);
    }

    // Fall back to TikTok API and save to DB
    try {
      const profile =
        await this.tiktokConnector.getCreatorProfile(creatorId);

      // Save/update profile data in DB
      if (entity) {
        await this.creatorRepo.update(entity.id, {
          biography: profile.biography || '',
          profileUrl: profile.profileUrl,
          gender: profile.gender,
          ageBucket: profile.ageBucket,
          mediaCount: profile.mediaCount,
          avgLikes: profile.avgLikes,
          avgComments: profile.avgComments,
          creatorPrice: profile.creatorPrice,
          currency: profile.currency,
          medianViews: profile.medianViews,
          interests: profile.interests || [],
          lastSyncedAt: new Date(),
        });
      } else {
        // Creator not in DB yet, save it
        const newCreator = this.creatorRepo.create({
          platformId: profile.id,
          platform: 'tiktok',
          username: profile.username,
          name: profile.name,
          profilePictureUrl: profile.profilePictureUrl,
          followersCount: profile.followersCount,
          engagementRate: profile.engagementRate,
          categories: profile.categories || [],
          isVerified: profile.isVerified || false,
          biography: profile.biography || '',
          profileUrl: profile.profileUrl,
          gender: profile.gender,
          ageBucket: profile.ageBucket,
          mediaCount: profile.mediaCount,
          avgLikes: profile.avgLikes,
          avgComments: profile.avgComments,
          creatorPrice: profile.creatorPrice,
          currency: profile.currency,
          medianViews: profile.medianViews,
          interests: profile.interests || [],
          lastSyncedAt: new Date(),
        });
        await this.creatorRepo.save(newCreator);
      }

      return profile;
    } catch (error) {
      // If API fails but we have basic data in DB, return that
      if (entity) {
        return this.entityToProfile(entity);
      }

      this.logger.error(
        `TikTok profile fetch failed for ${creatorId}: ${error.message}`,
      );
      throw new HttpException(
        {
          statusCode: 502,
          message: 'TIKTOK_API_ERROR',
          error: error.message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ─── Entity → Interface Mappers ─────────────────────────────

  private entityToSummary(entity: Creator): CreatorSummary {
    return {
      id: entity.platformId,
      platform: entity.platform as any,
      username: entity.username,
      name: entity.name,
      profilePictureUrl: entity.profilePictureUrl,
      followersCount: entity.followersCount,
      engagementRate: entity.engagementRate,
      categories: entity.categories || [],
      isVerified: entity.isVerified,
    };
  }

  private entityToProfile(entity: Creator): CreatorProfile {
    return {
      ...this.entityToSummary(entity),
      biography: entity.biography,
      profileUrl:
        entity.profileUrl ||
        `https://www.tiktok.com/@${entity.username}`,
      interests: entity.interests || [],
      gender: entity.gender,
      ageBucket: entity.ageBucket,
      mediaCount: entity.mediaCount,
      avgLikes: entity.avgLikes,
      avgComments: entity.avgComments,
      creatorPrice: entity.creatorPrice,
      currency: entity.currency,
      medianViews: entity.medianViews,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
