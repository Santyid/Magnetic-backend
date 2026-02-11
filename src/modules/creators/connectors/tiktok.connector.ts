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
  private readonly tcmAccountId: string;

  constructor(private configService: ConfigService) {
    this.accessToken =
      this.configService.get<string>('tiktok.accessToken') || '';
    this.advertiserId =
      this.configService.get<string>('tiktok.advertiserId') || '';
    this.tcmAccountId =
      this.configService.get<string>('tiktok.tcmAccountId') ||
      this.advertiserId;
  }

  /**
   * Search creators using the TikTok Creator Marketplace Discovery API.
   * Requires a Business API token and TikTok One account ID.
   * Endpoint: GET /tto/tcm/creator/discover/
   */
  async searchCreators(
    query: string,
    limit: number,
    cursor?: string,
  ): Promise<CreatorSearchResult> {
    try {
      const params: Record<string, any> = {
        tto_tcm_account_id: this.tcmAccountId,
        search_keyword: query,
        page_size: limit,
        country_codes: JSON.stringify(['US']),
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

      const creatorList = data.data?.creators || data.data?.creator_list || [];
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
      throw new Error('TIKTOK_SEARCH_FAILED');
    }
  }

  /**
   * Get detailed creator profile.
   * Requires a Business API token and TikTok One account ID.
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
            tto_tcm_account_id: this.tcmAccountId,
            handle_name: creatorId,
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
              tto_tcm_account_id: this.tcmAccountId,
              handle_name: creatorId,
              page_size: 9,
            },
          },
        );

        const videosData = videosResponse.data;
        const videoList =
          videosData.data?.posts || videosData.data?.video_list || [];
        if (videosData.code === 0 && videoList.length > 0) {
          profile.recentMedia = videoList.map((v: any) => ({
            id: v.video_id || v.item_id || String(Math.random()),
            type: 'VIDEO' as const,
            thumbnailUrl: v.thumbnail_url || v.cover_image_url,
            caption: v.caption || v.title,
            likeCount: v.likes || v.like_count || 0,
            commentCount: v.comments || v.comment_count || 0,
            timestamp: v.create_time
              ? new Date(parseInt(v.create_time, 10)).toISOString()
              : undefined,
          }));
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
    if (!this.tcmAccountId) {
      return {
        status: 'not_configured',
        message: 'TIKTOK_TCM_ACCOUNT_ID not set',
      };
    }

    try {
      const response = await axios.get(
        `${this.businessApiUrl}/tto/tcm/creator/discover/`,
        {
          headers: {
            'Access-Token': this.accessToken,
          },
          params: {
            tto_tcm_account_id: this.tcmAccountId,
            search_keyword: 'test',
            page_size: 1,
            country_codes: JSON.stringify(['US']),

          },
        },
      );

      if (response.data.code === 0) {
        return { status: 'ok', tokenType: 'business_api' };
      }

      return {
        status: 'error',
        message: `TTCM API error: ${response.data.message || 'Unknown'}`,
        tokenType: this.isV2Token() ? 'v2_oauth' : 'business_api',
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        tokenType: this.isV2Token() ? 'v2_oauth' : 'business_api',
      };
    }
  }

  private isV2Token(): boolean {
    return this.accessToken.startsWith('act.');
  }

  /**
   * Map raw TTCM API response to CreatorSummary.
   * Real fields: handle_name, display_name, followers_count, likes_count, profile_image, videos_count
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
    };
  }
}
