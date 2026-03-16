import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  CreatorSummary,
  CreatorProfile,
  CreatorSearchResult,
} from '../../../common/interfaces/creator.interface';

@Injectable()
export class TikTokConnector {
  private readonly logger = new Logger(TikTokConnector.name);
  private readonly businessApiUrl =
    'https://business-api.tiktok.com/open_api/v1.3';
  private accessToken: string;
  private readonly appId: string;
  private readonly appSecret: string;
  private refreshToken: string;
  private readonly advertiserId: string;
  private readonly tcmAccountId: string;
  private tokenExpiresAt: number;
  private refreshing: Promise<void> | null = null;

  /**
   * TikTok requires country_codes within the same region.
   * Searches run in parallel across available regions and results are merged.
   */
  private readonly regions: string[][] = [['US']];

  constructor(private configService: ConfigService) {
    this.accessToken =
      this.configService.get<string>('tiktok.accessToken') || '';
    this.appId = this.configService.get<string>('tiktok.appId') || '';
    this.appSecret = this.configService.get<string>('tiktok.appSecret') || '';
    this.refreshToken =
      this.configService.get<string>('tiktok.refreshToken') || '';
    this.advertiserId =
      this.configService.get<string>('tiktok.advertiserId') || '';
    this.tcmAccountId =
      this.configService.get<string>('tiktok.tcmAccountId') ||
      this.advertiserId;
    // Assume initial token is valid for 23h (avoid refresh on first call)
    this.tokenExpiresAt = this.accessToken
      ? Date.now() + 23 * 60 * 60 * 1000
      : 0;
  }

  /**
   * Get a valid access token, refreshing if needed.
   * Uses a lock (this.refreshing) to avoid concurrent refresh calls.
   */
  private async getValidToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (this.refreshing) {
      await this.refreshing;
      return this.accessToken;
    }

    this.refreshing = this.doRefreshToken();
    try {
      await this.refreshing;
    } finally {
      this.refreshing = null;
    }
    return this.accessToken;
  }

  /**
   * Refresh the access token using the refresh token.
   * Tries TikTok Business API endpoints. If refresh fails, the current
   * token is kept (it may still work). When it truly expires, re-authorize
   * via GET /api/tiktok/authorize.
   */
  private async doRefreshToken(): Promise<void> {
    if (!this.appId || !this.appSecret || !this.refreshToken) {
      this.logger.warn(
        'Cannot refresh TikTok token: missing appId, appSecret, or refreshToken. Re-authorize via /api/tiktok/authorize',
      );
      return;
    }

    this.logger.log('Attempting TikTok access token refresh...');

    // Try Business API auth_code exchange with refresh_token as auth_code
    const endpoints = [
      {
        url: `${this.businessApiUrl}/oauth2/access_token/`,
        body: {
          app_id: this.appId,
          secret: this.appSecret,
          auth_code: this.refreshToken,
          grant_type: 'auth_code',
        },
      },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.post(endpoint.url, endpoint.body);
        const data = response.data;

        if (data.code === 0 && data.data?.access_token) {
          this.accessToken = data.data.access_token;
          if (data.data.refresh_token) {
            this.refreshToken = data.data.refresh_token;
          }
          const expiresIn = data.data.access_token_expires_in || 86400;
          this.tokenExpiresAt = Date.now() + (expiresIn - 3600) * 1000;
          this.logger.log('TikTok access token refreshed successfully');
          return;
        }

        this.logger.warn(
          `TikTok refresh attempt returned code ${data.code}: ${data.message}`,
        );
      } catch (error) {
        this.logger.warn(
          `TikTok refresh attempt failed: ${error.response?.status || error.message}`,
        );
      }
    }

    this.logger.warn(
      'TikTok token refresh failed. Current token will be used. Re-authorize via /api/tiktok/authorize if expired.',
    );
  }

  /**
   * Handle API response errors. If token expired (40105), refresh and retry once.
   */
  private async apiGet(
    url: string,
    params: Record<string, any>,
  ): Promise<any> {
    const token = await this.getValidToken();
    const response = await axios.get(url, {
      headers: { 'Access-Token': token },
      params,
    });

    const data = response.data;

    // 40105 = token expired/revoked, 40104 = token empty
    if (data.code === 40105 || data.code === 40104) {
      this.tokenExpiresAt = 0; // force refresh
      const newToken = await this.getValidToken();
      if (newToken !== token) {
        const retryResponse = await axios.get(url, {
          headers: { 'Access-Token': newToken },
          params,
        });
        return retryResponse.data;
      }
    }

    return data;
  }

  /**
   * Search creators across all TikTok regions in parallel.
   * Merges results and sorts by followers count descending.
   */
  async searchCreators(
    query: string,
    limit: number,
    cursor?: string,
  ): Promise<CreatorSearchResult> {
    try {
      const perRegionLimit = Math.max(
        Math.ceil(limit / this.regions.length),
        5,
      );
      const page = cursor ? parseInt(cursor, 10) || 1 : undefined;

      const regionResults = await Promise.allSettled(
        this.regions.map((codes) =>
          this.searchRegion(query, perRegionLimit, codes, page),
        ),
      );

      const allCreators: CreatorSummary[] = [];
      let totalCount = 0;
      let anyHasNextPage = false;
      const seen = new Set<string>();

      for (const result of regionResults) {
        if (result.status !== 'fulfilled') continue;
        const { creators, total, hasNextPage } = result.value;
        totalCount += total;
        if (hasNextPage) anyHasNextPage = true;
        for (const creator of creators) {
          if (!seen.has(creator.id)) {
            seen.add(creator.id);
            allCreators.push(creator);
          }
        }
      }

      // Sort by followers descending and take the requested limit
      allCreators.sort((a, b) => b.followersCount - a.followersCount);
      const trimmed = allCreators.slice(0, limit);
      const currentPage = page || 1;

      return {
        creators: trimmed,
        paging: {
          cursors: anyHasNextPage
            ? { after: String(currentPage + 1) }
            : undefined,
          hasNextPage: anyHasNextPage,
        },
        totalCount,
      };
    } catch (error) {
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(
        `TikTok creator search failed for "${query}": ${detail}`,
      );
      throw new Error('TIKTOK_SEARCH_FAILED');
    }
  }

  private async searchRegion(
    query: string,
    limit: number,
    countryCodes: string[],
    page?: number,
  ): Promise<{
    creators: CreatorSummary[];
    total: number;
    hasNextPage: boolean;
  }> {
    const params: Record<string, any> = {
      tto_tcm_account_id: this.tcmAccountId,
      search_keyword: query,
      page_size: limit,
      country_codes: JSON.stringify(countryCodes),
    };

    if (page) {
      params.page = page;
    }

    const data = await this.apiGet(
      `${this.businessApiUrl}/tto/tcm/creator/discover/`,
      params,
    );

    if (data.code !== 0) {
      this.logger.warn(
        `TikTok region ${countryCodes[0]} search error: ${data.message}`,
      );
      return { creators: [], total: 0, hasNextPage: false };
    }

    const creatorList = data.data?.creators || data.data?.creator_list || [];
    const creators = creatorList.map((raw: any) =>
      this.mapToCreatorSummary(raw),
    );

    const pageInfo = data.data?.page_info || {};
    const currentPage = pageInfo.page || 1;
    const total = pageInfo.total_number || 0;

    return {
      creators,
      total,
      hasNextPage: currentPage * limit < total,
    };
  }

  /**
   * Get detailed creator profile.
   * Requires a Business API token and TikTok One account ID.
   */
  async getCreatorProfile(creatorId: string): Promise<CreatorProfile> {
    try {
      const data = await this.apiGet(
        `${this.businessApiUrl}/tto/tcm/creator/public/`,
        {
          tto_tcm_account_id: this.tcmAccountId,
          handle_name: creatorId,
        },
      );

      if (data.code !== 0) {
        this.logger.error(
          `TikTok profile API error: ${data.message} (code: ${data.code})`,
        );
        throw new Error('TIKTOK_PROFILE_FAILED');
      }

      const raw = data.data;
      if (!raw) {
        throw new Error('Creator not found');
      }

      return this.mapToCreatorProfile(raw);
    } catch (error) {
      this.logger.error(
        `TikTok profile fetch failed for ${creatorId}: ${error.response?.data?.message || error.message}`,
      );
      throw new Error('TIKTOK_PROFILE_FAILED');
    }
  }

  /**
   * Validate the TikTok API connection.
   */
  async validateConnection(): Promise<{
    status: string;
    message?: string;
    tokenType?: string;
  }> {
    if (!this.accessToken && !this.refreshToken) {
      return {
        status: 'not_configured',
        message: 'TIKTOK_ACCESS_TOKEN and TIKTOK_REFRESH_TOKEN not set',
      };
    }
    if (!this.tcmAccountId) {
      return {
        status: 'not_configured',
        message: 'TIKTOK_TCM_ACCOUNT_ID not set',
      };
    }

    try {
      const data = await this.apiGet(
        `${this.businessApiUrl}/tto/tcm/creator/discover/`,
        {
          tto_tcm_account_id: this.tcmAccountId,
          search_keyword: 'test',
          page_size: 1,
          country_codes: JSON.stringify(['US']),
        },
      );

      if (data.code === 0) {
        return { status: 'ok', tokenType: 'business_api' };
      }

      return {
        status: 'error',
        message: `TTCM API error: ${data.message || 'Unknown'}`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  /**
   * Map raw TTCM API response to CreatorSummary.
   */
  private mapToCreatorSummary(raw: any): CreatorSummary {
    return {
      id: raw.handle_name || raw.creator_id || raw.user_id || '',
      platform: 'tiktok',
      username: raw.handle_name || raw.display_name || '',
      name: raw.display_name || raw.handle_name || '',
      profilePictureUrl: raw.profile_image || raw.avatar_url,
      followersCount: raw.followers_count || raw.follower_count || 0,
      engagementRate: raw.engagement_rate || 0,
      categories:
        raw.content_labels?.map((l: any) => l.label_name) ||
        raw.labels ||
        raw.categories ||
        [],
      isVerified: raw.is_verified || false,
    };
  }

  private mapToCreatorProfile(raw: any): CreatorProfile {
    const summary = this.mapToCreatorSummary(raw);

    return {
      ...summary,
      biography: raw.bio || raw.signature,
      profileUrl: `https://www.tiktok.com/@${raw.handle_name || summary.username}`,
      interests:
        raw.industry_labels?.map((l: any) => l.label_name) ||
        raw.interests ||
        [],
      gender: raw.gender,
      ageBucket: raw.age_range || raw.age_bucket,
      mediaCount: raw.videos_count || raw.video_count,
      avgLikes: raw.avg_like_count || raw.avg_likes,
      avgComments: raw.avg_comment_count || raw.avg_comments,
      creatorPrice: raw.creator_price || undefined,
      currency: raw.currency || undefined,
      medianViews: raw.median_views || undefined,
    };
  }
}
