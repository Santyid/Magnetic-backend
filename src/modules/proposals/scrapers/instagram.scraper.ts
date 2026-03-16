import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  InstagramFollower,
  InstagramFollowersResult,
  InstagramInfoResult,
  InstagramPostsResult,
  InstagramScrapedData,
} from '../interfaces/instagram.interface';

const MAX_POSTS = 18;
const MAX_FOLLOWERS = 18;

@Injectable()
export class InstagramScraper {
  private readonly logger = new Logger(InstagramScraper.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://media-api4.p.rapidapi.com',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'media-api4.p.rapidapi.com',
        'x-rapidapi-key': this.configService.get<string>('rapidapi.instagramKey'),
      },
    });
  }

  async scrape(usernameOrUrl: string): Promise<InstagramScrapedData> {
    const identifier = this.normalizeIdentifier(usernameOrUrl);

    try {
      // Obtener perfil y posts en paralelo
      const [infoRes, postsRes, followersRes] = await Promise.all([
        this.client.get<InstagramInfoResult>('/v1/info', {
          params: { username_or_id_or_url: identifier },
        }),
        this.client.get<InstagramPostsResult>('/v1/posts', {
          params: { username_or_id_or_url: identifier },
        }),
        this.client.get<InstagramFollowersResult>('/v1/followers', {
          params: { username_or_id_or_url: identifier, amount: 30 },
        }),
      ]);

      const profile = infoRes.data?.data;
      const posts = (postsRes.data?.data?.items ?? []).slice(0, MAX_POSTS);
      // Pedimos 30 para tener margen cuando algún enriquecimiento falla
      const followerCandidates = (followersRes.data?.data?.items ?? [])
        .filter((u) => !u.is_private)
        .slice(0, 30);

      if (!profile) throw new Error('INSTAGRAM_PROFILE_NOT_FOUND');

      // Enrich followers with their own follower count
      // NOTE: Use profile_pic_url from the followers list (EU CDN / scontent-vie1-1),
      // NOT from /v1/info which returns geo-routed US CDN URLs that block cross-origin loads.
      const igFollowers: InstagramFollower[] = (
        await Promise.all(
          followerCandidates.map(async (u) => {
            try {
              const res = await this.client.get<InstagramInfoResult>('/v1/info', {
                params: { username_or_id_or_url: u.username },
              });
              const p = res.data?.data;
              if (!p) return null;
              return {
                username: p.username,
                fullName: p.full_name ?? u.full_name ?? '',
                followerCount: p.follower_count ?? 0,
                isVerified: p.is_verified ?? u.is_verified ?? false,
                // Use pic from followers list (always scontent-vie1-1, works cross-origin)
                profilePicUrl: u.profile_pic_url ?? '',
                profileUrl: `https://www.instagram.com/${p.username}/`,
                biography: p.biography?.slice(0, 80) ?? '',
              } as InstagramFollower;
            } catch {
              return null;
            }
          }),
        )
      )
        .filter((f): f is InstagramFollower => f !== null)
        .sort((a, b) => b.followerCount - a.followerCount)
        .slice(0, MAX_FOLLOWERS);

      return {
        username: profile.username,
        fullName: profile.full_name,
        followers: profile.follower_count ?? 0,
        mediaCount: profile.media_count ?? 0,
        posts: posts.map((p) => {
          const thumbnailUrl =
            p.thumbnail_url ??
            p.carousel_media?.[0]?.thumbnail_url ??
            undefined;
          return {
            likes: p.like_count ?? 0,
            comments: p.comment_count ?? 0,
            reposts: p.share_count ?? 0,
            timestamp: p.taken_at,
            thumbnailUrl,
            postUrl: p.code ? `https://www.instagram.com/p/${p.code}/` : undefined,
            caption: p.caption?.text ?? undefined,
            isVideo: p.is_video ?? false,
            isCarousel: p.media_type === 8,
          };
        }),
        igFollowers,
      };
    } catch (error) {
      const status = error?.response?.status ?? 'no-http';
      const body = JSON.stringify(error?.response?.data ?? {});
      this.logger.error(`Instagram scrape failed for ${identifier}: ${error.message} | status=${status} | body=${body}`);
      throw new Error(`INSTAGRAM_FETCH_FAILED: ${error.message} [${status}]`);
    }
  }

  // Extrae username de una URL de Instagram o devuelve el string tal cual
  private normalizeIdentifier(input: string): string {
    try {
      const url = new URL(input);
      if (url.hostname.includes('instagram.com')) {
        // https://www.instagram.com/santyid/ → santyid
        const parts = url.pathname.split('/').filter(Boolean);
        return parts[0] ?? input;
      }
    } catch {
      // No es URL — asumir que ya es un username
    }
    return input.replace('@', '');
  }
}
