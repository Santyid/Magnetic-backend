export type CreatorPlatform = 'facebook' | 'instagram';

export interface CreatorSummary {
  id: string;
  platform: CreatorPlatform;
  username: string;
  name: string;
  profilePictureUrl?: string;
  followersCount: number;
  engagementRate: number;
  categories?: string[];
  isVerified?: boolean;
}

export interface CreatorProfile extends CreatorSummary {
  biography?: string;
  profileUrl?: string;
  coverPhotoUrl?: string;
  interests?: string[];
  email?: string;
  gender?: string;
  ageBucket?: string;
  mediaCount?: number;
  avgLikes?: number;
  avgComments?: number;
  recentMedia?: Array<{
    id: string;
    type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
    thumbnailUrl?: string;
    caption?: string;
    likeCount: number;
    commentCount: number;
    timestamp?: string;
  }>;
}

export interface CreatorSearchResult {
  creators: CreatorSummary[];
  paging: {
    cursors?: {
      before?: string;
      after?: string;
    };
    hasNextPage: boolean;
  };
  totalCount?: number;
}
