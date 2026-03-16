import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  TikTokUserResponse,
  TikTokPostsResponse,
  TikTokFollowersResponse,
  TikTokScrapedData,
  TikTokFollower,
} from '../interfaces/tiktok.interface';

const MAX_POSTS = 10;
const MAX_FOLLOWERS = 18;

@Injectable()
export class TikTokScraper {
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://scraptik.p.rapidapi.com',
      headers: {
        'x-rapidapi-host': 'scraptik.p.rapidapi.com',
        'x-rapidapi-key': this.configService.get<string>('rapidapi.instagramKey'),
      },
      decompress: true,
    });
  }

  async scrape(usernameOrUrl: string): Promise<TikTokScrapedData> {
    const username = this.normalizeUsername(usernameOrUrl);

    // 1. User info
    const userRes = await this.client.get<TikTokUserResponse>('/get-user', {
      params: { username },
    });

    const userInfo = userRes.data?.user;
    if (!userInfo?.sec_uid) throw new Error('TIKTOK_USER_NOT_FOUND');

    const secUid = userInfo.sec_uid;
    const avatarUrl =
      userInfo.avatar_larger?.url_list?.find((u) => u.includes('.webp')) ??
      userInfo.avatar_larger?.url_list?.[0];

    // 2. Posts + followers en paralelo
    const [postsRes, followersRes] = await Promise.allSettled([
      this.client.get<TikTokPostsResponse>('/user-posts', {
        params: { sec_user_id: secUid, count: MAX_POSTS, max_cursor: 0 },
      }),
      this.client.get<TikTokFollowersResponse>('/list-followers', {
        params: { sec_user_id: secUid, count: MAX_FOLLOWERS, max_time: 0 },
      }),
    ]);

    const posts = postsRes.status === 'fulfilled'
      ? (postsRes.value.data?.aweme_list ?? []).slice(0, MAX_POSTS)
      : [];

    const rawFollowers = followersRes.status === 'fulfilled'
      ? (followersRes.value.data?.followers ?? []).slice(0, MAX_FOLLOWERS)
      : [];

    const ttFollowers: TikTokFollower[] = rawFollowers
      .filter((f) => !f.secret)
      .map((f) => ({
        username: f.unique_id,
        fullName: f.nickname,
        followerCount: f.follower_count ?? 0,
        profilePicUrl:
          f.avatar_larger?.url_list?.find((u) => u.includes('.webp')) ??
          f.avatar_larger?.url_list?.[0] ??
          '',
        profileUrl: `https://www.tiktok.com/@${f.unique_id}`,
        biography: f.signature,
      }))
      .sort((a, b) => b.followerCount - a.followerCount);

    return {
      username: userInfo.unique_id,
      nickname: userInfo.nickname,
      followers: userInfo.follower_count ?? 0,
      totalVideos: userInfo.aweme_count ?? 0,
      avatarUrl,
      posts: posts.map((p) => ({
        likes: p.statistics?.digg_count ?? 0,
        comments: p.statistics?.comment_count ?? 0,
        reposts: p.statistics?.repost_count ?? 0,
        plays: p.statistics?.play_count ?? 0,
        timestamp: p.create_time,
        thumbnailUrl: p.video?.dynamic_cover?.url_list?.[0] ?? p.video?.cover?.url_list?.[0],
        postUrl: p.share_url,
        caption: p.desc,
      })),
      ttFollowers,
    };
  }

  private normalizeUsername(input: string): string {
    try {
      const url = new URL(input);
      if (url.hostname.includes('tiktok.com')) {
        const parts = url.pathname.split('/').filter(Boolean);
        return (parts[0] ?? input).replace('@', '');
      }
    } catch {
      // not a URL
    }
    return input.replace('@', '');
  }
}
