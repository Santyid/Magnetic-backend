import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  CreatorPlatform,
  CreatorSummary,
  CreatorProfile,
  CreatorSearchResult,
} from '../interfaces/creator.interface';

@Injectable()
export class MetaConnector {
  private readonly logger = new Logger(MetaConnector.name);
  private readonly baseUrl: string;
  private readonly userAccessToken: string;
  private readonly pageId: string;

  // Page access token — obtained dynamically from user token + page ID
  private pageAccessToken: string | null = null;
  private pageTokenExpiresAt = 0;

  constructor(private configService: ConfigService) {
    const version =
      this.configService.get<string>('meta.graphApiVersion') || 'v24.0';
    this.baseUrl = `https://graph.facebook.com/${version}`;
    this.userAccessToken =
      this.configService.get<string>('meta.accessToken') || '';
    this.pageId = this.configService.get<string>('meta.pageId') || '';
  }

  /**
   * Get or refresh the Page Access Token.
   * The Creator Marketplace API requires a Page Access Token, not a User token.
   * We obtain it by requesting /{pageId}?fields=access_token with the User token.
   */
  private async getPageAccessToken(): Promise<string> {
    // Reuse cached token if still valid (cache for 50 minutes)
    if (this.pageAccessToken && Date.now() < this.pageTokenExpiresAt) {
      return this.pageAccessToken;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/${this.pageId}`, {
        params: {
          fields: 'access_token',
          access_token: this.userAccessToken,
        },
      });

      this.pageAccessToken = response.data.access_token;
      // Cache for 50 minutes (tokens typically last ~1h)
      this.pageTokenExpiresAt = Date.now() + 50 * 60 * 1000;

      this.logger.log('Page Access Token obtained successfully');
      return this.pageAccessToken;
    } catch (error) {
      this.logger.error(
        `Failed to obtain Page Access Token: ${error.response?.data?.error?.message || error.message}`,
      );
      throw new Error('META_PAGE_TOKEN_FAILED');
    }
  }

  /**
   * Search creators using the Facebook Creator Marketplace Discovery API.
   * Endpoint: GET /creator_marketplace/creators?query={q}&fields=...
   * Docs: https://developers.facebook.com/docs/fb-creator-discovery
   */
  async searchCreators(
    query: string,
    platform: CreatorPlatform,
    limit: number,
    cursor?: string,
  ): Promise<CreatorSearchResult> {
    const accessToken = await this.getPageAccessToken();

    const fields = [
      'creator_id',
      'creator_display_name',
      'creator_alias',
      'creator_bio',
      'creator_profile_image_url',
      'creator_follower_count',
      'creator_categories',
    ].join(',');

    try {
      const response = await axios.get(
        `${this.baseUrl}/creator_marketplace/creators`,
        {
          params: {
            query,
            fields,
            limit,
            ...(cursor && { after: cursor }),
            ...(platform === 'instagram' && { platform: 'instagram' }),
            access_token: accessToken,
          },
        },
      );

      const data = response.data;
      const creators: CreatorSummary[] = (data.data || []).map((raw: any) =>
        this.mapToCreatorSummary(raw, platform),
      );

      return {
        creators,
        paging: {
          cursors: data.paging?.cursors,
          hasNextPage: !!data.paging?.next,
        },
        totalCount: data.summary?.total_count,
      };
    } catch (error) {
      this.logger.error(
        `Meta creator search failed for "${query}" (${platform}): ${error.response?.data?.error?.message || error.message}`,
      );
      throw new Error('META_SEARCH_FAILED');
    }
  }

  /**
   * Get detailed creator profile.
   * Uses the same /creator_marketplace/creators endpoint with creator_id param.
   * Also fetches content from /creator_marketplace/content.
   */
  async getCreatorProfile(
    creatorId: string,
    platform: CreatorPlatform = 'facebook',
  ): Promise<CreatorProfile> {
    const accessToken = await this.getPageAccessToken();

    const fields = [
      'creator_id',
      'creator_display_name',
      'creator_alias',
      'creator_bio',
      'creator_profile_url',
      'creator_profile_image_url',
      'creator_cover_photo_url',
      'creator_follower_count',
      'creator_categories',
      'creator_interests',
      'creator_email',
      'creator_gender',
      'creator_age_bucket',
      'recent_content',
    ].join(',');

    try {
      const response = await axios.get(
        `${this.baseUrl}/creator_marketplace/creators`,
        {
          params: {
            creator_id: creatorId,
            fields,
            ...(platform === 'instagram' && { platform: 'instagram' }),
            access_token: accessToken,
          },
        },
      );

      const raw = (response.data.data || [])[0];
      if (!raw) {
        throw new Error('Creator not found');
      }

      const profile = this.mapToCreatorProfile(raw, platform);

      // Fetch recent content details
      try {
        const contentResponse = await axios.get(
          `${this.baseUrl}/creator_marketplace/content`,
          {
            params: {
              creator_id: creatorId,
              fields:
                'content_id,content_type,content_url,content_thumbnail_url,content_title,content_publish_time,like_count,comment_count,share_count,view_count',
              limit: 9,
              ...(platform === 'instagram' && { platform: 'instagram' }),
              access_token: accessToken,
            },
          },
        );

        profile.recentMedia = (contentResponse.data?.data || []).map(
          (c: any) => ({
            id: c.content_id,
            type: this.mapContentType(c.content_type),
            thumbnailUrl: c.content_thumbnail_url,
            caption: c.content_title,
            likeCount: c.like_count || 0,
            commentCount: c.comment_count || 0,
            timestamp: c.content_publish_time,
          }),
        );
      } catch (contentError) {
        this.logger.warn(
          `Failed to fetch content for creator ${creatorId} (${platform}): ${contentError.message}`,
        );
      }

      return profile;
    } catch (error) {
      this.logger.error(
        `Meta profile fetch failed for ${creatorId} (${platform}): ${error.response?.data?.error?.message || error.message}`,
      );
      throw new Error('META_PROFILE_FAILED');
    }
  }

  /**
   * Validate the Meta API connection.
   * Checks that the user token is valid and a Page Access Token can be obtained.
   */
  async validateConnection(): Promise<{ status: string; message?: string }> {
    if (!this.userAccessToken) {
      return { status: 'not_configured', message: 'META_ACCESS_TOKEN not set' };
    }
    if (!this.pageId) {
      return { status: 'not_configured', message: 'META_PAGE_ID not set' };
    }

    try {
      await this.getPageAccessToken();
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  private mapContentType(
    metaType: string,
  ): 'IMAGE' | 'VIDEO' | 'CAROUSEL' {
    switch (metaType) {
      case 'REELS':
      case 'VIDEOS':
        return 'VIDEO';
      case 'PHOTOS':
        return 'IMAGE';
      default:
        return 'IMAGE';
    }
  }

  private mapToCreatorSummary(raw: any, platform: CreatorPlatform = 'facebook'): CreatorSummary {
    return {
      id: raw.creator_id,
      platform,
      username: raw.creator_alias || raw.creator_display_name || '',
      name: raw.creator_display_name || raw.creator_alias || '',
      profilePictureUrl: raw.creator_profile_image_url,
      followersCount: raw.creator_follower_count || 0,
      engagementRate: 0, // Not directly available in search; computed from content if needed
      categories: raw.creator_categories || [],
      isVerified: false, // Not provided by the FB Creator Discovery API
    };
  }

  private mapToCreatorProfile(raw: any, platform: CreatorPlatform = 'facebook'): CreatorProfile {
    const summary = this.mapToCreatorSummary(raw, platform);

    return {
      ...summary,
      biography: raw.creator_bio,
      profileUrl: raw.creator_profile_url,
      coverPhotoUrl: raw.creator_cover_photo_url,
      interests: raw.creator_interests || [],
      email: raw.creator_email,
      gender: raw.creator_gender,
      ageBucket: raw.creator_age_bucket,
    };
  }
}
