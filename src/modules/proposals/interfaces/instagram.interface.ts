export interface InstagramProfile {
  id: string;
  username: string;
  full_name: string;
  biography: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  profile_pic_url: string;
  is_verified: boolean;
  is_business: boolean;
}

export interface InstagramPost {
  id: string;
  code: string; // shortcode → https://www.instagram.com/p/{code}/
  media_type: number; // 1=photo, 2=video, 8=carousel
  is_video: boolean;
  like_count: number;
  comment_count: number;
  share_count: number | null;
  taken_at: number; // Unix timestamp
  thumbnail_url?: string;
  caption?: { text: string } | null;
  carousel_media?: { thumbnail_url?: string }[];
}

export interface InstagramPostsResult {
  data: {
    items: InstagramPost[];
  };
  pagination_token: string | null;
}

export interface InstagramInfoResult {
  data: InstagramProfile;
}

export interface InstagramFollowersResult {
  data: {
    items: { username: string; full_name: string; profile_pic_url: string; is_private: boolean; is_verified: boolean }[];
  };
}

export interface InstagramFollower {
  username: string;
  fullName: string;
  followerCount: number;
  isVerified: boolean;
  profilePicUrl: string;
  profileUrl: string;
  biography?: string;
}

// Resultado normalizado para el motor de análisis
export interface InstagramScrapedData {
  username: string;
  fullName: string;
  followers: number;
  mediaCount: number;
  posts: {
    likes: number;
    comments: number;
    reposts: number;
    timestamp: number;
    thumbnailUrl?: string;
    postUrl?: string;
    caption?: string;
    isVideo?: boolean;
    isCarousel?: boolean;
  }[];
  igFollowers?: InstagramFollower[];
}
