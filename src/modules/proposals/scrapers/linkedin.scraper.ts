import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  LinkedInCompany,
  LinkedInCompanyPost,
  LinkedInEmployee,
} from '../interfaces/linkedin.interface';

@Injectable()
export class LinkedInScraper {
  private readonly logger = new Logger(LinkedInScraper.name);

  private readonly client = axios.create({
    baseURL: 'https://fresh-linkedin-scraper-api.p.rapidapi.com',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': 'fresh-linkedin-scraper-api.p.rapidapi.com',
    },
  });

  constructor(private readonly configService: ConfigService) {
    this.client.defaults.headers['x-rapidapi-key'] =
      this.configService.get<string>('rapidapi.key');
  }

  async getCompany(linkedinUrl: string): Promise<LinkedInCompany> {
    try {
      const slug = this.extractCompanySlug(linkedinUrl);

      // Step 1: Company profile
      const profileRes = await this.client.get('/api/v1/company/profile', {
        params: { company: slug },
      });
      const profile = profileRes.data?.data;
      if (!profile) throw new Error('Empty profile response');

      const companyId = profile.id;

      // Step 2: Posts + people (pages 1 and 2) in parallel
      const [postsRes, people1Res, people2Res] = await Promise.allSettled([
        this.client.get('/api/v1/company/posts', {
          params: { company_id: companyId, page: 1 },
        }),
        this.client.get('/api/v1/company/people', {
          params: { company_id: companyId, page: 1 },
        }),
        this.client.get('/api/v1/company/people', {
          params: { company_id: companyId, page: 2 },
        }),
      ]);

      const rawPosts =
        postsRes.status === 'fulfilled'
          ? (postsRes.value.data?.data ?? [])
          : [];
      const rawPeople1 =
        people1Res.status === 'fulfilled'
          ? (people1Res.value.data?.data ?? [])
          : [];
      const rawPeople2 =
        people2Res.status === 'fulfilled'
          ? (people2Res.value.data?.data ?? [])
          : [];
      const rawPeople = [...rawPeople1, ...rawPeople2];

      const rawPostsArray = Array.isArray(rawPosts) ? rawPosts : [];
      const postsMapped = rawPostsArray.map((p: any) => {
        const { imageUrl, contentType, documentTitle, documentPageCount, manifestUrl } =
          this.extractPostContent(p);
        return {
          url: p.url ?? '',
          date_published: p.created_at ?? '',
          likes: p.activity?.num_likes ?? 0,
          comments: p.activity?.num_comments ?? 0,
          reposts: p.activity?.num_shares ?? 0,
          text: p.text ?? '',
          imageUrl,
          contentType,
          documentTitle,
          documentPageCount,
          _manifestUrl: manifestUrl,
        };
      });

      // Fetch document cover images in parallel (best-effort)
      const posts: LinkedInCompanyPost[] = await Promise.all(
        postsMapped.map(async (p) => {
          const { _manifestUrl, ...post } = p;
          const coverImageUrl =
            post.contentType === 'document' && _manifestUrl
              ? await this.fetchDocumentCover(_manifestUrl)
              : undefined;
          return { ...post, coverImageUrl } as LinkedInCompanyPost;
        }),
      );

      const employees: LinkedInEmployee[] = (
        Array.isArray(rawPeople) ? rawPeople : []
      )
        .filter(
          (e: any) =>
            e.full_name &&
            e.full_name !== 'LinkedIn Member' &&
            e.public_identifier,
        )
        .map((e: any) => ({
          name: e.full_name ?? '',
          title: e.title ?? null,
          url: e.url ?? '',
          publicIdentifier: decodeURIComponent(e.public_identifier ?? ''),
          avatar: e.avatar?.[0]?.url ?? '',
          location: e.location ?? '',
        }));

      const hq = profile.headquarter;
      const headquarters = hq
        ? [hq.city, hq.country].filter(Boolean).join(', ')
        : '';

      return {
        success: true,
        companyId,
        name: profile.name ?? '',
        description: profile.description ?? '',
        logo: profile.logo?.[0]?.url ?? '',
        website: profile.website_url ?? '',
        employee_count: profile.employee_count ?? 0,
        followers: profile.follower_count ?? 0,
        industry: profile.industries?.[0] ?? '',
        size: profile.employee_count_range
          ? `${profile.employee_count_range.start}-${profile.employee_count_range.end}`
          : '',
        headquarters,
        specialties: Array.isArray(profile.specialities)
          ? profile.specialities
          : [],
        posts,
        employees,
      };
    } catch (error) {
      const status = error.response?.status;
      const data = JSON.stringify(error.response?.data);
      this.logger.error(
        `LinkedIn getCompany failed [${status}]: ${error.message} | ${data}`,
      );
      throw new Error('LINKEDIN_COMPANY_FETCH_FAILED');
    }
  }

  async getEmployeeFollowers(publicIdentifier: string): Promise<number> {
    try {
      // Build URL directly to avoid axios double-encoding percent signs in the identifier
      const encoded = encodeURIComponent(publicIdentifier);
      const res = await this.client.get(
        `/api/v1/user/follower-and-connection?username=${encoded}`,
      );
      return res.data?.data?.follower_count ?? 0;
    } catch (error) {
      this.logger.warn(
        `Could not fetch followers for ${publicIdentifier}: ${error.message}`,
      );
      return 0;
    }
  }

  private extractCompanySlug(url: string): string {
    const match = url.match(/linkedin\.com\/company\/([^/?#]+)/);
    if (match) return match[1];
    return url.trim().replace(/\/$/, '');
  }

  private extractPostContent(post: any): {
    imageUrl: string;
    contentType: 'image' | 'document' | 'video' | 'text';
    documentTitle?: string;
    documentPageCount?: number;
    manifestUrl?: string;
  } {
    const content = post.content;

    // Document (carousel / PDF)
    if (content?.document) {
      return {
        imageUrl: '',
        contentType: 'document',
        documentTitle: content.document.title ?? undefined,
        documentPageCount: content.document.total_page_count ?? undefined,
        manifestUrl: content.document.manifest_url ?? undefined,
      };
    }

    // Video
    if (content?.video) {
      const thumbnails: any[] = content.video.thumbnail ?? [];
      const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
      return { imageUrl: sorted[0]?.url ?? '', contentType: 'video' };
    }

    // Images
    const images = content?.images;
    if (Array.isArray(images) && images.length > 0) {
      const imageArray = images[0]?.image;
      if (Array.isArray(imageArray) && imageArray.length > 0) {
        const img800 = imageArray.find((i: any) => i.width === 800);
        const url = img800?.url ?? [...imageArray].sort(
          (a: any, b: any) => (b.width ?? 0) - (a.width ?? 0),
        )[0]?.url ?? '';
        if (url) return { imageUrl: url, contentType: 'image' };
      }
    }

    return { imageUrl: '', contentType: 'text' };
  }

  private async fetchDocumentCover(manifestUrl: string): Promise<string> {
    try {
      // Step 1: master manifest → perResolutions[]
      const masterRes = await axios.get(manifestUrl, { timeout: 6000 });
      const perResolutions: any[] = masterRes.data?.perResolutions ?? [];
      if (perResolutions.length === 0) return '';

      // Pick resolution closest to 800px
      const sorted = [...perResolutions].sort(
        (a, b) => Math.abs(a.width - 800) - Math.abs(b.width - 800),
      );
      const imageManifestUrl = sorted[0]?.imageManifestUrl;
      if (!imageManifestUrl) return '';

      // Step 2: image manifest → pages[]
      const pagesRes = await axios.get(imageManifestUrl, { timeout: 6000 });
      const pages: string[] = pagesRes.data?.pages ?? [];
      return pages[0] ?? '';
    } catch {
      return '';
    }
  }
}
