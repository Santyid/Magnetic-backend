import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  FacebookScrapedData,
  FacebookPostsResult,
  FacebookPageDetails,
  FacebookProfileDetails,
} from '../interfaces/facebook.interface';

const MAX_POSTS = 9;
const MAX_PAGES = 3; // máximo de páginas de paginación para no agotar créditos

@Injectable()
export class FacebookScraper {
  private readonly logger = new Logger(FacebookScraper.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://facebook-scraper3.p.rapidapi.com',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'facebook-scraper3.p.rapidapi.com',
        'x-rapidapi-key': this.configService.get<string>('rapidapi.key'),
      },
    });
  }

  /**
   * Auto-detecta si la URL es página o perfil: llama /page/details primero,
   * usa results.type para decidir el flujo de posts. Si falla, cae a /profile/details_url.
   */
  async scrape(facebookUrl: string): Promise<FacebookScrapedData> {
    try {
      const detailsRes = await this.client.get<FacebookPageDetails>('/page/details', {
        params: { url: facebookUrl },
      });
      const page = detailsRes.data?.results;

      if (page?.page_id && page?.type === 'page') {
        return this.scrapePageById(page, facebookUrl);
      }

      // /page/details respondió pero es un perfil — caemos a flujo profile
    } catch {
      // /page/details falló — caemos a flujo profile
    }

    return this.scrapeProfile(facebookUrl);
  }

  // ─── PAGE flow ────────────────────────────────────────────────────────────

  private async scrapePageById(
    page: FacebookPageDetails['results'],
    originalUrl: string,
  ): Promise<FacebookScrapedData> {
    try {
      const posts = await this.fetchAllPosts('/page/posts', { page_id: page.page_id });

      return {
        sourceType: 'page',
        sourceId: page.page_id,
        name: page.name ?? originalUrl,
        avatarUrl: page.image,
        followers: page.followers ?? page.likes ?? 0,
        pageUrl: page.url ?? originalUrl,
        posts: posts.map((p) => ({
          likes: p.reactions?.like ?? 0,
          comments: p.comments_count ?? 0,
          reposts: p.reshare_count ?? 0,
          reactions_count: p.reactions_count ?? 0,
          timestamp: p.timestamp,
          thumbnailUrl: (typeof p.image === 'string' ? p.image : p.image?.uri) ?? p.video_thumbnail,
          postUrl: p.url,
          caption: p.message ?? undefined,
        })),
      };
    } catch (error) {
      this.logger.error(`Facebook page posts failed for ${page.page_id}: ${error.message}`);
      throw new Error('FACEBOOK_PAGE_FETCH_FAILED');
    }
  }

  // ─── PROFILE flow ─────────────────────────────────────────────────────────

  // ─── Paginación helper ────────────────────────────────────────────────────

  private async fetchAllPosts(
    endpoint: string,
    baseParams: Record<string, string>,
  ): Promise<FacebookPostsResult['results']> {
    const collected: FacebookPostsResult['results'] = [];
    let cursor: string | undefined;
    let page = 0;

    while (collected.length < MAX_POSTS && page < MAX_PAGES) {
      const params: Record<string, string> = cursor
        ? { ...baseParams, cursor }
        : { ...baseParams };

      const res = await this.client.get<FacebookPostsResult>(endpoint, { params });
      const batch = res.data?.results ?? [];
      collected.push(...batch);
      cursor = res.data?.cursor ?? undefined;
      page++;

      if (!cursor || batch.length === 0) break;
    }

    return collected.slice(0, MAX_POSTS);
  }

  // ─── PROFILE flow ─────────────────────────────────────────────────────────

  private async scrapeProfile(url: string): Promise<FacebookScrapedData> {
    try {
      const detailsRes = await this.client.get<FacebookProfileDetails>('/profile/details_url', {
        params: { url },
      });
      const profile = detailsRes.data?.profile;

      if (!profile?.profile_id) throw new Error('PROFILE_ID_NOT_FOUND');

      const posts = await this.fetchAllPosts('/profile/posts', { profile_id: profile.profile_id });

      return {
        sourceType: 'profile',
        sourceId: profile.profile_id,
        name: profile.name ?? url,
        avatarUrl: profile.image,
        followers: 0,
        pageUrl: profile.url ?? url,
        posts: posts.map((p) => ({
          likes: p.reactions?.like ?? 0,
          comments: p.comments_count ?? 0,
          reposts: p.reshare_count ?? 0,
          reactions_count: p.reactions_count ?? 0,
          timestamp: p.timestamp,
          thumbnailUrl: (typeof p.image === 'string' ? p.image : p.image?.uri) ?? p.video_thumbnail,
          postUrl: p.url,
          caption: p.message ?? undefined,
        })),
      };
    } catch (error) {
      this.logger.error(`Facebook scrapeProfile failed for ${url}: ${error.message}`);
      throw new Error('FACEBOOK_PROFILE_FETCH_FAILED');
    }
  }
}
