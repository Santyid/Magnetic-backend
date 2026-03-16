export interface LinkedInCompanyPost {
  url: string;
  date_published: string;
  likes: number;
  comments: number;
  reposts: number;
  text?: string;
  imageUrl?: string;
  contentType?: 'image' | 'document' | 'video' | 'text';
  documentTitle?: string;
  documentPageCount?: number;
  coverImageUrl?: string;
}

export interface LinkedInEmployee {
  name: string;
  title?: string | null;
  url: string;
  publicIdentifier: string;
  avatar?: string;
  location?: string;
}

export interface LinkedInCompany {
  success: boolean;
  companyId: string;
  name: string;
  description: string;
  logo: string;
  website: string;
  employee_count: number;
  followers: number;
  industry: string;
  size: string;
  headquarters: string;
  specialties: string[];
  posts: LinkedInCompanyPost[];
  employees: LinkedInEmployee[];
}
