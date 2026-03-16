export interface TikTokUserResponse {
  user: {
    uid: string;
    sec_uid: string;
    unique_id: string;
    nickname: string;
    follower_count: number;
    following_count: number;
    aweme_count: number;
    avatar_larger: { url_list: string[] };
  };
}

export interface TikTokPostStatistics {
  digg_count: number;
  comment_count: number;
  share_count: number;
  play_count: number;
  repost_count: number;
}

export interface TikTokPost {
  aweme_id: string;
  desc: string;
  create_time: number;
  statistics: TikTokPostStatistics;
  video: {
    cover: { url_list: string[] };
    dynamic_cover: { url_list: string[] };
  };
  share_url: string;
}

export interface TikTokPostsResponse {
  aweme_list: TikTokPost[];
  has_more: boolean;
  max_cursor: number;
}

export interface TikTokFollowersResponse {
  followers: TikTokFollowerRaw[];
  has_more: boolean;
  total: number;
}

export interface TikTokFollowerRaw {
  uid: string;
  sec_uid: string;
  unique_id: string;
  nickname: string;
  follower_count: number;
  avatar_larger: { url_list: string[] };
  signature?: string;
  secret?: boolean;
}

export interface TikTokFollower {
  username: string;
  fullName: string;
  followerCount: number;
  profilePicUrl: string;
  profileUrl: string;
  biography?: string;
}

export interface TikTokScrapedData {
  username: string;
  nickname: string;
  followers: number;
  totalVideos: number;
  avatarUrl?: string;
  posts: {
    likes: number;
    comments: number;
    reposts: number;
    plays: number;
    timestamp: number;
    thumbnailUrl?: string;
    postUrl?: string;
    caption?: string;
  }[];
  ttFollowers?: TikTokFollower[];
}
