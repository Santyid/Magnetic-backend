export type FacebookSourceType = 'page' | 'profile';

export interface FacebookPostReactions {
  like: number;
  love: number;
  haha: number;
  wow: number;
  care: number;
  sad: number;
  angry: number;
}

export interface FacebookPost {
  post_id: string;
  type: string;
  url: string;
  message: string | null;
  timestamp: number;
  comments_count: number;
  reactions_count: number;
  reshare_count: number;
  reactions: FacebookPostReactions;
  image?: string | { id: string; uri: string; width: number; height: number };
  video?: string;
  video_thumbnail?: string;
}

export interface FacebookPageDetails {
  results: {
    name: string;
    type: string; // 'page' | 'profile' — discriminador para auto-detect
    page_id: string;
    url: string;
    image: string;
    followers: number;
    likes: number;
    categories: string[];
    website: string;
    verified: boolean;
  };
}

export interface FacebookProfileDetails {
  profile: {
    name: string;
    profile_id: string;
    url: string;
    image: string;
    intro: string;
    gender: string;
    about_public: { text: string }[];
  };
}

export interface FacebookPostsResult {
  results: FacebookPost[];
  cursor?: string;
}

// Resultado normalizado para el motor de análisis
export interface FacebookScrapedData {
  sourceType: FacebookSourceType;
  sourceId: string;
  name: string;
  avatarUrl?: string;
  followers: number;
  pageUrl?: string;
  posts: {
    likes: number;
    comments: number;
    reposts: number;
    reactions_count: number;
    timestamp: number;
    thumbnailUrl?: string;
    postUrl?: string;
    caption?: string;
  }[];
}
