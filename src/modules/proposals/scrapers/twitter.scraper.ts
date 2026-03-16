import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  TwitterScrapedData,
  TwitterPost,
  TwitterFollower,
} from '../interfaces/twitter.interface';

const MAX_POSTS = 10;
const MAX_FOLLOWERS = 18;

@Injectable()
export class TwitterScraper {
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://api.twitterapi.io',
      headers: {
        'X-API-Key': this.configService.get<string>('twitterapi.key'),
      },
    });
  }

  async scrape(usernameOrUrl: string): Promise<TwitterScrapedData> {
    const username = this.normalizeUsername(usernameOrUrl);

    // 1. User info + posts + followers in parallel
    const [userRes, tweetsRes, followersRes] = await Promise.allSettled([
      this.client.get('/twitter/user/info', { params: { userName: username } }),
      this.client.get('/twitter/user/last_tweets', { params: { userName: username } }),
      this.client.get('/twitter/user/followers', { params: { userName: username, pageSize: MAX_FOLLOWERS } }),
    ]);

    if (userRes.status === 'rejected') {
      throw new Error('TWITTER_USER_NOT_FOUND');
    }

    const user = userRes.value.data?.data;
    if (!user?.id) throw new Error('TWITTER_USER_NOT_FOUND');

    // 2. Map tweets
    const rawTweets: any[] = tweetsRes.status === 'fulfilled'
      ? (tweetsRes.value.data?.data?.tweets ?? []).slice(0, MAX_POSTS)
      : [];

    const posts: TwitterPost[] = rawTweets.map((t) => {
      const media = t.extendedEntities?.media;
      const thumbnailUrl = Array.isArray(media) && media.length > 0
        ? media[0].media_url_https
        : undefined;

      return {
        id: t.id,
        url: t.url ?? t.twitterUrl,
        text: t.text ?? '',
        likes: t.likeCount ?? 0,
        comments: t.replyCount ?? 0,
        reposts: t.retweetCount ?? 0,
        views: t.viewCount ?? 0,
        quotes: t.quoteCount ?? 0,
        timestamp: t.createdAt,
        thumbnailUrl,
      };
    });

    // 3. Map followers (response is at root, not under data)
    const rawFollowers: any[] = followersRes.status === 'fulfilled'
      ? (followersRes.value.data?.followers ?? []).slice(0, MAX_FOLLOWERS)
      : [];

    const twFollowers: TwitterFollower[] = rawFollowers
      .map((f) => ({
        username: f.userName ?? f.screen_name,
        fullName: f.name,
        followerCount: f.followers_count ?? 0,
        profilePicUrl: (f.profile_image_url_https ?? '').replace('_normal.', '_400x400.'),
        profileUrl: `https://x.com/${f.userName ?? f.screen_name}`,
        description: f.description,
      }))
      .sort((a, b) => b.followerCount - a.followerCount);

    return {
      username: user.userName,
      displayName: user.name,
      followers: user.followers ?? 0,
      following: user.following ?? 0,
      totalTweets: user.statusesCount ?? 0,
      profilePicUrl: (user.profilePicture ?? '').replace('_normal.', '_400x400.') || undefined,
      coverPicUrl: user.coverPicture,
      description: user.description,
      posts,
      twFollowers,
    };
  }

  private normalizeUsername(input: string): string {
    try {
      const url = new URL(input);
      if (url.hostname.includes('twitter.com') || url.hostname.includes('x.com')) {
        const parts = url.pathname.split('/').filter(Boolean);
        return (parts[0] ?? input).replace('@', '');
      }
    } catch {
      // not a URL
    }
    return input.replace('@', '');
  }
}
