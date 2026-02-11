import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  CreatorSummary,
  CreatorProfile,
  CreatorSearchResult,
} from '../interfaces/creator.interface';

@Injectable()
export class TikTokConnector {
  private readonly logger = new Logger(TikTokConnector.name);
  private readonly businessApiUrl =
    'https://business-api.tiktok.com/open_api/v1.3';
  private readonly accessToken: string;
  private readonly advertiserId: string;

  constructor(private configService: ConfigService) {
    this.accessToken =
      this.configService.get<string>('tiktok.accessToken') || '';
    this.advertiserId =
      this.configService.get<string>('tiktok.advertiserId') || '';
  }

  /**
   * Search creators using the TikTok Creator Marketplace Discovery API.
   * Requires a Business API token (NOT a v2 OAuth token).
   * Endpoint: GET /tto/tcm/creator/discover/
   */
  async searchCreators(
    query: string,
    limit: number,
    cursor?: string,
  ): Promise<CreatorSearchResult> {
    try {
      const params: Record<string, any> = {
        advertiser_id: this.advertiserId,
        search_keyword: query,
        page_size: limit,
      };

      if (cursor) {
        params.page = parseInt(cursor, 10) || 1;
      }

      const response = await axios.get(
        `${this.businessApiUrl}/tto/tcm/creator/discover/`,
        {
          headers: {
            'Access-Token': this.accessToken,
          },
          params,
        },
      );

      const data = response.data;

      if (data.code !== 0) {
        this.logger.error(
          `TikTok TTCM API error: ${data.message} (code: ${data.code})`,
        );
        throw new Error(
          `TIKTOK_SEARCH_FAILED: ${data.message || 'Unknown error'} (code: ${data.code})`,
        );
      }

      const creatorList = data.data?.creator_list || [];
      const creators: CreatorSummary[] = creatorList.map((raw: any) =>
        this.mapToCreatorSummary(raw),
      );

      const pageInfo = data.data?.page_info || {};
      const currentPage = pageInfo.page || 1;
      const totalCount = pageInfo.total_number || 0;
      const hasNextPage = currentPage * limit < totalCount;

      return {
        creators,
        paging: {
          cursors: hasNextPage
            ? { after: String(currentPage + 1) }
            : undefined,
          hasNextPage,
        },
        totalCount,
      };
    } catch (error) {
      const detail =
        error.response?.data
          ? JSON.stringify(error.response.data)
          : error.message;
      this.logger.error(
        `TikTok creator search failed for "${query}": ${detail}`,
      );

      if (this.isV2Token()) {
        this.logger.error(
          'Token appears to be a v2 OAuth token (act.*). TTCM endpoints require a Business API token from business-api.tiktok.com',
        );
      }

      throw new Error('TIKTOK_SEARCH_FAILED');
    }
  }

  /**
   * Get detailed creator profile.
   * Requires a Business API token.
   */
  async getCreatorProfile(creatorId: string): Promise<CreatorProfile> {
    try {
      const response = await axios.get(
        `${this.businessApiUrl}/tto/tcm/creator/public/`,
        {
          headers: {
            'Access-Token': this.accessToken,
          },
          params: {
            advertiser_id: this.advertiserId,
            creator_id: creatorId,
          },
        },
      );

      const data = response.data;

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

      const profile = this.mapToCreatorProfile(raw);

      // Fetch recent videos
      try {
        const videosResponse = await axios.get(
          `${this.businessApiUrl}/tto/tcm/creator/public/video/list/`,
          {
            headers: {
              'Access-Token': this.accessToken,
            },
            params: {
              advertiser_id: this.advertiserId,
              creator_id: creatorId,
              page_size: 9,
            },
          },
        );

        const videosData = videosResponse.data;
        if (videosData.code === 0 && videosData.data?.video_list) {
          profile.recentMedia = videosData.data.video_list.map(
            (v: any) => ({
              id: v.video_id || v.item_id || String(Math.random()),
              type: 'VIDEO' as const,
              thumbnailUrl: v.cover_image_url || v.video_cover_url,
              caption: v.caption || v.title,
              likeCount: v.like_count || 0,
              commentCount: v.comment_count || 0,
              timestamp: v.create_time
                ? new Date(v.create_time * 1000).toISOString()
                : undefined,
            }),
          );
        }
      } catch (videoError) {
        this.logger.warn(
          `Failed to fetch videos for TikTok creator ${creatorId}: ${videoError.message}`,
        );
      }

      return profile;
    } catch (error) {
      this.logger.error(
        `TikTok profile fetch failed for ${creatorId}: ${error.response?.data?.message || error.message}`,
      );
      throw new Error('TIKTOK_PROFILE_FAILED');
    }
  }

  /**
   * Validate the TikTok API connection.
   * Tests both Business API and v2 API to detect token type.
   */
  async validateConnection(): Promise<{
    status: string;
    message?: string;
    tokenType?: string;
  }> {
    if (!this.accessToken) {
      return {
        status: 'not_configured',
        message: 'TIKTOK_ACCESS_TOKEN not set',
      };
    }
    if (!this.advertiserId) {
      return {
        status: 'not_configured',
        message: 'TIKTOK_ADVERTISER_ID not set',
      };
    }

    // Detect token type
    const tokenType = this.isV2Token() ? 'v2_oauth' : 'business_api';

    // Test Business API (required for TTCM)
    try {
      const response = await axios.get(
        `${this.businessApiUrl}/tto/tcm/category/label/`,
        {
          headers: {
            'Access-Token': this.accessToken,
          },
          params: {
            advertiser_id: this.advertiserId,
          },
        },
      );

      if (response.data.code === 0) {
        return { status: 'ok', tokenType: 'business_api' };
      }

      return {
        status: 'error',
        message: `Business API error: ${response.data.message || 'Unknown'}`,
        tokenType,
      };
    } catch (error) {
      // If Business API fails and token is v2, that's the likely cause
      if (tokenType === 'v2_oauth') {
        return {
          status: 'wrong_token_type',
          message:
            'Token is a v2 OAuth token (from developers.tiktok.com). ' +
            'TTCM endpoints require a Business API token from business-api.tiktok.com. ' +
            'Register at business-api.tiktok.com/portal/developer/register and create a Business API app.',
          tokenType,
        };
      }

      return {
        status: 'error',
        message: error.message,
        tokenType,
      };
    }
  }

  /**
   * Detect if the current token is a v2 OAuth token.
   * v2 tokens start with 'act.' prefix.
   */
  private isV2Token(): boolean {
    return this.accessToken.startsWith('act.');
  }

  private mapToCreatorSummary(raw: any): CreatorSummary {
    return {
      id: raw.creator_id || raw.user_id || '',
      platform: 'tiktok',
      username: raw.display_name || raw.nickname || '',
      name: raw.nickname || raw.display_name || '',
      profilePictureUrl: raw.avatar_url || raw.profile_image,
      followersCount: raw.follower_count || 0,
      engagementRate: raw.engagement_rate || 0,
      categories: raw.labels || raw.categories || [],
      isVerified: raw.is_verified || false,
    };
  }

  private mapToCreatorProfile(raw: any): CreatorProfile {
    const summary = this.mapToCreatorSummary(raw);

    return {
      ...summary,
      biography: raw.bio || raw.signature,
      profileUrl:
        raw.profile_url ||
        (raw.display_name
          ? `https://www.tiktok.com/@${raw.display_name}`
          : undefined),
      interests: raw.interests || raw.labels || [],
      gender: raw.gender,
      ageBucket: raw.age_range || raw.age_bucket,
      mediaCount: raw.video_count || raw.media_count,
      avgLikes: raw.avg_like_count || raw.avg_likes,
      avgComments: raw.avg_comment_count || raw.avg_comments,
    };
  }
}
