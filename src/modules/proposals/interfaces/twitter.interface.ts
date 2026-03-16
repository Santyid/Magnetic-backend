export interface TwitterPost {
  id: string;
  url: string;
  text: string;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  quotes: number;
  timestamp: string;
  thumbnailUrl?: string;
}

export interface TwitterFollower {
  username: string;
  fullName: string;
  followerCount: number;
  profilePicUrl: string;
  profileUrl: string;
  description?: string;
}

export interface TwitterScrapedData {
  username: string;
  displayName: string;
  followers: number;
  following: number;
  totalTweets: number;
  profilePicUrl?: string;
  coverPicUrl?: string;
  description?: string;
  posts: TwitterPost[];
  twFollowers: TwitterFollower[];
}
