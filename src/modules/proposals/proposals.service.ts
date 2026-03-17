import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proposal } from './entities/proposal.entity';
import { ProposalCompany } from './entities/proposal-company.entity';
import { ProposalProjection } from './entities/proposal-projection.entity';
import { FacebookScraper } from './scrapers/facebook.scraper';
import { InstagramScraper } from './scrapers/instagram.scraper';
import { TikTokScraper } from './scrapers/tiktok.scraper';
import { TwitterScraper } from './scrapers/twitter.scraper';
import { AnalysisService, PlatformData, ProjectionResult } from './analysis.service';
import { AiService } from '../ai/ai.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { LinkedInScraper } from './scrapers/linkedin.scraper';
import { ProposalEmployee } from './entities/proposal-employee.entity';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    @InjectRepository(Proposal)
    private readonly proposalRepo: Repository<Proposal>,
    @InjectRepository(ProposalCompany)
    private readonly companyRepo: Repository<ProposalCompany>,
    @InjectRepository(ProposalProjection)
    private readonly projectionRepo: Repository<ProposalProjection>,
    @InjectRepository(ProposalEmployee)
    private readonly employeeRepo: Repository<ProposalEmployee>,
    private readonly linkedInScraper: LinkedInScraper,
    private readonly facebookScraper: FacebookScraper,
    private readonly instagramScraper: InstagramScraper,
    private readonly tiktokScraper: TikTokScraper,
    private readonly twitterScraper: TwitterScraper,
    private readonly analysisService: AnalysisService,
    private readonly aiService: AiService,
  ) {}

  async create(adminUserId: string, dto: CreateProposalDto): Promise<Proposal> {
    const platforms = dto.platforms?.length ? dto.platforms : [];

    const proposal = this.proposalRepo.create({
      adminUserId,
      linkedinCompanyUrl: this.cleanLinkedInUrl(dto.linkedinCompanyUrl),
      platforms,
      status: 'pending',
    });
    await this.proposalRepo.save(proposal);

    this.processProposal(proposal.id, dto).catch(
      (err) => this.logger.error(`Proposal ${proposal.id} failed: ${err.message}`),
    );

    return proposal;
  }

  async findAll(adminUserId: string): Promise<any[]> {
    const proposals = await this.proposalRepo.find({
      where: { adminUserId },
      order: { createdAt: 'DESC' },
      relations: ['company'],
    });

    return proposals.map((p) => ({
      id: p.id,
      linkedinCompanyUrl: p.linkedinCompanyUrl,
      platforms: p.platforms,
      status: p.status,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
      companyName: p.company?.name ?? null,
      companyLogo: p.company?.logo ?? null,
      companyIndustry: p.company?.industry ?? null,
      companyDescription: p.company?.description ?? null,
    }));
  }

  async findOne(id: string, adminUserId: string): Promise<Proposal> {
    const proposal = await this.proposalRepo.findOne({
      where: { id, adminUserId },
      relations: ['company', 'employees', 'projections'],
    });

    if (!proposal) throw new NotFoundException('PROPOSAL_NOT_FOUND');
    return proposal;
  }

  async getStatus(id: string, adminUserId: string): Promise<{ status: string; progress: number; completedAt?: Date }> {
    const proposal = await this.proposalRepo.findOne({
      where: { id, adminUserId },
      select: ['id', 'status', 'progress', 'completedAt', 'errorMessage'],
    });

    if (!proposal) throw new NotFoundException('PROPOSAL_NOT_FOUND');
    return { status: proposal.status, progress: proposal.progress ?? 0, completedAt: proposal.completedAt };
  }

  async remove(id: string, adminUserId: string): Promise<void> {
    const proposal = await this.proposalRepo.findOne({
      where: { id, adminUserId },
      relations: ['company', 'employees', 'projections'],
    });
    if (!proposal) throw new NotFoundException('PROPOSAL_NOT_FOUND');
    await this.proposalRepo.remove(proposal);
  }

  async getAiAnalysis(id: string, adminUserId: string): Promise<Record<string, unknown>> {
    const proposal = await this.proposalRepo.findOne({
      where: { id, adminUserId },
      relations: ['company', 'projections'],
    });
    if (!proposal) throw new NotFoundException('PROPOSAL_NOT_FOUND');

    // Si ya existe análisis guardado, devolverlo directamente
    if (proposal.aiAnalysis) {
      return JSON.parse(proposal.aiAnalysis);
    }

    // Generar nuevo análisis con IA
    const analysis = await this.aiService.analyzeProposal({
      company: proposal.company,
      projections: proposal.projections,
    });

    // Persistir para futuras llamadas
    await this.proposalRepo.update(id, { aiAnalysis: JSON.stringify(analysis) });

    return analysis;
  }

  // ─── Proceso principal (asíncrono) ───────────────────────────────────────

  private async processProposal(proposalId: string, dto: CreateProposalDto): Promise<void> {
    await this.proposalRepo.update(proposalId, { status: 'processing', progress: 0 });
    const platforms = dto.platforms?.length ? dto.platforms : [];
    const setProgress = (pct: number) => this.proposalRepo.update(proposalId, { progress: pct });

    try {
      // ── 0. Limpiar URL de LinkedIn ──────────────────────────────────────
      const cleanUrl = this.cleanLinkedInUrl(dto.linkedinCompanyUrl);

      // ── 1. LinkedIn (scraper real via RapidAPI) ────────────────────────
      await setProgress(5);
      const liData = await this.linkedInScraper.getCompany(cleanUrl);
      this.logger.log(`[${proposalId}] LinkedIn scraped: ${liData.name} (${liData.followers} followers, ${liData.employees.length} employees)`);
      await setProgress(15);

      // ── 2. Guardar empresa ───────────────────────────────────────────────
      const company = this.companyRepo.create({
        proposalId,
        name: dto.companyName || liData.name,
        industry: liData.industry,
        description: liData.description,
        logo: liData.logo,
        website: liData.website || cleanUrl,
        employeeCount: liData.employee_count,
        followers: liData.followers,
        headquarters: liData.headquarters,
        linkedinPosts: liData.posts,
      });
      await this.companyRepo.save(company);

      // ── 2b. Guardar empleados + obtener followers ─────────────────────
      let ambassadorCount = 0;
      let ambassadorFollowers = 0;
      let scrapedWithFollowers = 0;

      if (liData.employees.length > 0) {
        // Guardar hasta 100 empleados en BD
        const MAX_EMPLOYEES_SAVED = 100;
        const allEmployees = liData.employees.slice(0, MAX_EMPLOYEES_SAVED);

        // Llamados API para followers: ≤5 → todos; >5 → 10%, máximo 5
        // Limited to 5 to stay within 20 req/min RapidAPI rate limit
        const MAX_FOLLOWER_CALLS = 5;
        const callCount = allEmployees.length <= MAX_FOLLOWER_CALLS
          ? allEmployees.length
          : Math.min(Math.ceil(allEmployees.length * 0.1), MAX_FOLLOWER_CALLS);

        // Consultar followers solo para los primeros `callCount`
        const employeesToScrape = allEmployees.slice(0, callCount);
        const followerResults = await Promise.allSettled(
          employeesToScrape.map((e) => this.linkedInScraper.getEmployeeFollowers(e.publicIdentifier)),
        );

        // Crear entidades: los scrapeados con followers reales, el resto con 0
        const employeeEntities: ProposalEmployee[] = [];
        for (let i = 0; i < allEmployees.length; i++) {
          const emp = allEmployees[i];
          let followers = 0;
          if (i < callCount) {
            const result = followerResults[i];
            followers = result.status === 'fulfilled' ? result.value : 0;
          }
          ambassadorFollowers += followers;

          employeeEntities.push(this.employeeRepo.create({
            proposalId,
            name: emp.name,
            title: emp.title ?? undefined,
            linkedinUrl: emp.url,
            location: emp.location,
            avatar: emp.avatar,
            linkedinFollowers: followers,
          }));
        }

        await this.employeeRepo.save(employeeEntities);
        ambassadorCount = employeeEntities.length;
        scrapedWithFollowers = callCount;
        this.logger.log(`[${proposalId}] Saved ${ambassadorCount} employees, total followers: ${ambassadorFollowers}`);
      }

      await setProgress(30);

      // ── 3. Industry para benchmarks ───────────────────────────────────
      const industry = liData.industry ?? undefined;
      const projectionResults: ProjectionResult[] = [];

      // ── 4. Proyección LinkedIn (solo si tiene datos y está en platforms) ──
      if (platforms.includes('linkedin') && liData.followers > 0) {
        const result = await this.saveProjection(proposalId, {
          platform: 'linkedin',
          followers: liData.followers,
          posts: liData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
          ambassadorCount,
          ambassadorFollowers,
        }, industry);
        projectionResults.push(result);
      }

      await setProgress(40);

      // ── 5. Facebook (opcional) ───────────────────────────────────────────
      if (platforms.includes('facebook') && dto.facebookUrl) {
        const result = await this.processFacebook(
          proposalId, company, dto.facebookUrl,
          ambassadorCount, ambassadorFollowers, industry,
        );
        if (result) projectionResults.push(result);
      }

      await setProgress(50);

      // ── 6. Instagram (opcional) ──────────────────────────────────────────
      this.logger.log(`[${proposalId}] Instagram check: platforms=${JSON.stringify(platforms)}, handle="${dto.instagramHandle}"`);
      if (platforms.includes('instagram') && dto.instagramHandle) {
        const result = await this.processInstagram(
          proposalId, company, dto.instagramHandle,
          ambassadorCount, ambassadorFollowers, industry,
        );
        if (result) projectionResults.push(result);
      }

      await setProgress(60);

      // ── 7. TikTok (opcional) ─────────────────────────────────────────────
      if (platforms.includes('tiktok') && dto.tiktokHandle) {
        const result = await this.processTikTok(
          proposalId, company, dto.tiktokHandle,
          ambassadorCount, ambassadorFollowers, industry,
        );
        if (result) projectionResults.push(result);
      }

      await setProgress(65);

      // ── 8. Twitter/X (opcional) ──────────────────────────────────────────
      if (platforms.includes('twitter') && dto.twitterHandle) {
        const result = await this.processTwitter(
          proposalId, company, dto.twitterHandle,
          ambassadorCount, ambassadorFollowers, industry,
        );
        if (result) projectionResults.push(result);
      }

      await setProgress(70);

      // ── 9. Advocacy Score + Total ROI ─────────────────────────────────
      const employees = await this.employeeRepo.find({ where: { proposalId } });
      const advocacyScore = this.analysisService.calculateAdvocacyScore(
        projectionResults, employees.length, ambassadorFollowers, liData.followers, liData.employee_count, scrapedWithFollowers,
      );
      const totalEarnedMedia = projectionResults.reduce((sum, p) => sum + p.earnedMediaValue, 0);

      this.logger.log(`[${proposalId}] Advocacy score: ${advocacyScore.score}, Total earned media: $${totalEarnedMedia}`);

      await setProgress(80);

      // ── 9b. Competitor analysis (best-effort, does NOT block proposal) ──
      let competitors: any[] | null = null;
      let competitorAnalysisJson: string | undefined;
      try {
        const hq = company.headquarters ?? '';
        const country = hq.includes(',') ? hq.split(',').pop()!.trim() : (hq || 'Colombia');

        // Extract own company slug to exclude from competitors
        const ownSlugMatch = cleanUrl.match(/linkedin\.com\/company\/([^/?#]+)/);
        const ownSlug = ownSlugMatch ? ownSlugMatch[1].toLowerCase() : '';

        const slugs = await this.aiService.identifyCompetitors(
          company.name, liData.industry, country,
        );

        // Filter out the company's own slug
        const filteredSlugs = slugs.filter((s) => s.toLowerCase() !== ownSlug);
        this.logger.log(`[${proposalId}] AI identified ${slugs.length} slugs, ${filteredSlugs.length} after filtering self (${ownSlug}): ${filteredSlugs.join(', ')}`);

        if (filteredSlugs.length > 0) {
          // Cooldown: wait 3s for RapidAPI rate limit to recover after main company scraping
          this.logger.log(`[${proposalId}] Waiting 3s before competitor fetching (rate limit cooldown)...`);
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Fetch profiles + posts sequentially to avoid rate limiting
          competitors = [];
          for (const slug of filteredSlugs) {
            try {
              const profile = await this.linkedInScraper.getCompanyProfile(slug);
              competitors.push({ ...profile, slug });
              this.logger.log(`[${proposalId}] Competitor ${slug}: ${profile.name} (${profile.followers} followers, ER: ${profile.engagement.engagementRate}%)`);
            } catch (err) {
              const httpStatus = err?.response?.status ?? err?.status ?? 'unknown';
              this.logger.warn(`[${proposalId}] Competitor ${slug} failed [${httpStatus}]: ${err.message}`);
            }
            // Delay between competitors (1 API call each: profile only)
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
          this.logger.log(`[${proposalId}] Fetched ${competitors.length}/${slugs.length} competitor profiles`);

          // Calculate company's own engagement from LinkedIn posts
          const companyPosts = liData.posts ?? [];
          let companyEngagement = { avgLikes: 0, avgComments: 0, engagementRate: 0, postsPerMonth: 0 };
          if (companyPosts.length > 0) {
            const totalL = companyPosts.reduce((s, p) => s + (p.likes ?? 0), 0);
            const totalC = companyPosts.reduce((s, p) => s + (p.comments ?? 0), 0);
            const totalR = companyPosts.reduce((s, p) => s + (p.reposts ?? 0), 0);
            companyEngagement.avgLikes = Math.round(totalL / companyPosts.length);
            companyEngagement.avgComments = Math.round(totalC / companyPosts.length);
            const totalInt = totalL + totalC + totalR;
            companyEngagement.engagementRate = liData.followers > 0
              ? parseFloat(((totalInt / companyPosts.length / liData.followers) * 100).toFixed(2))
              : 0;
            companyEngagement.postsPerMonth = companyPosts.length; // approx from 1 page
          }

          // AI brand evaluation with real engagement data
          if (competitors.length > 0) {
            try {
              const brandAnalysis = await this.aiService.analyzeCompetitorBrand({
                company: {
                  name: company.name,
                  followers: liData.followers,
                  employeeCount: liData.employee_count,
                  industry: liData.industry,
                  engagement: companyEngagement,
                },
                competitors: competitors.map((c) => ({
                  name: c.name,
                  followers: c.followers,
                  employeeCount: c.employeeCount,
                  industry: c.industry,
                  engagement: {
                    avgLikes: c.engagement?.avgLikes ?? 0,
                    avgComments: c.engagement?.avgComments ?? 0,
                    engagementRate: c.engagement?.engagementRate ?? 0,
                    postsPerMonth: c.engagement?.postsPerMonth ?? 0,
                  },
                })),
              });
              competitorAnalysisJson = JSON.stringify(brandAnalysis);
              this.logger.log(`[${proposalId}] AI brand analysis generated`);
            } catch (aiErr) {
              this.logger.warn(`[${proposalId}] AI brand analysis failed (non-fatal): ${aiErr.message}`);
            }
          }
        }
      } catch (err) {
        this.logger.warn(`[${proposalId}] Competitor analysis failed (non-fatal): ${err.message}`);
      }

      await setProgress(95);

      // ── 10. Completado ───────────────────────────────────────────────────
      const proposal = await this.proposalRepo.findOne({ where: { id: proposalId } });
      if (proposal) {
        proposal.status = 'done';
        proposal.progress = 100;
        proposal.completedAt = new Date();
        proposal.companyName = company.name;
        proposal.advocacyScore = advocacyScore;
        proposal.totalEarnedMedia = totalEarnedMedia;
        proposal.competitors = competitors;
        proposal.competitorAnalysis = competitorAnalysisJson;
        await this.proposalRepo.save(proposal);
      }

      this.logger.log(`[${proposalId}] Proposal completed successfully`);
    } catch (error) {
      this.logger.error(`[${proposalId}] Processing failed: ${error.message}`);
      await this.proposalRepo.update(proposalId, {
        status: 'failed',
        errorMessage: error.message,
      });
    }
  }

  // ─── Facebook ─────────────────────────────────────────────────────────────

  private async processFacebook(
    proposalId: string,
    _company: ProposalCompany,
    facebookUrl: string,
    ambassadorCount: number,
    ambassadorFollowers: number,
    industry?: string,
  ): Promise<ProjectionResult | null> {
    this.logger.log(`[${proposalId}] Fetching Facebook: ${facebookUrl}`);
    try {
      const fbData = await this.facebookScraper.scrape(facebookUrl);

      const company = await this.companyRepo.findOne({ where: { proposalId } });
      if (!company) throw new Error(`Company not found for proposal ${proposalId}`);

      const fbDataToSave = {
        sourceType: fbData.sourceType,
        sourceId: fbData.sourceId,
        name: fbData.name,
        avatarUrl: fbData.avatarUrl,
        followers: fbData.followers,
        pageUrl: fbData.pageUrl,
        posts: fbData.posts,
      };
      await this.companyRepo.query(
        `UPDATE proposal_companies SET facebook_data = $1::jsonb WHERE id = $2`,
        [JSON.stringify(fbDataToSave, this.sanitizeForJsonb), company.id],
      );

      const projectionFollowers = fbData.followers > 0
        ? fbData.followers
        : fbData.posts.length > 0
          ? Math.max(...fbData.posts.map((p) => p.reactions_count)) * 20
          : 1000;

      return await this.saveProjection(proposalId, {
        platform: 'facebook',
        followers: projectionFollowers,
        posts: fbData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
        ambassadorCount,
        ambassadorFollowers,
      }, industry);
    } catch (error) {
      this.logger.warn(`[${proposalId}] Facebook failed (non-fatal): ${error.message}`);
      return null;
    }
  }

  // ─── Instagram ────────────────────────────────────────────────────────────

  private async processInstagram(
    proposalId: string,
    _company: ProposalCompany,
    instagramHandle: string,
    ambassadorCount: number,
    ambassadorFollowers: number,
    industry?: string,
  ): Promise<ProjectionResult | null> {
    this.logger.log(`[${proposalId}] Fetching Instagram: ${instagramHandle}`);
    try {
      const igData = await this.instagramScraper.scrape(instagramHandle);
      this.logger.log(`[${proposalId}] Instagram scraped OK: ${igData.followers} followers, ${igData.posts.length} posts, ${igData.igFollowers?.length ?? 0} igFollowers`);

      // Re-fetch company by proposalId to guarantee a valid DB-assigned id
      const company = await this.companyRepo.findOne({ where: { proposalId } });
      if (!company) throw new Error(`Company not found for proposal ${proposalId}`);
      this.logger.log(`[${proposalId}] Company found: id=${company.id}`);

      // Guardar proyección PRIMERO (antes del UPDATE con JSON grande que trunca logs)
      const projResult = await this.saveProjection(proposalId, {
        platform: 'instagram',
        followers: igData.followers,
        posts: igData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts ?? 0 })),
        ambassadorCount,
        ambassadorFollowers,
      }, industry);
      this.logger.log(`[${proposalId}] Instagram projection saved OK`);

      const igDataToSave = {
        username: igData.username,
        fullName: igData.fullName,
        followers: igData.followers,
        mediaCount: igData.mediaCount,
        posts: igData.posts,
        igFollowers: igData.igFollowers,
      };
      try {
        const jsonStr = JSON.stringify(igDataToSave, this.sanitizeForJsonb).replace(/\u0000/g, '');
        await this.companyRepo.query(
          `UPDATE proposal_companies SET instagram_data = $1::jsonb WHERE id = $2`,
          [jsonStr, company.id],
        );
        this.logger.log(`[${proposalId}] Instagram data saved OK`);
      } catch (saveErr) {
        this.logger.error(`[${proposalId}] Instagram data SAVE FAILED: ${saveErr.message}`);
      }

      return projResult;
    } catch (error) {
      const status = error?.response?.status ?? 'no-http';
      const body = JSON.stringify(error?.response?.data ?? {});
      this.logger.warn(`[${proposalId}] Instagram failed (non-fatal): ${error.message} | status=${status} | body=${body}`);
      return null;
    }
  }

  // ─── Twitter ──────────────────────────────────────────────────────────────

  private async processTwitter(
    proposalId: string,
    _company: ProposalCompany,
    twitterHandle: string,
    ambassadorCount: number,
    ambassadorFollowers: number,
    industry?: string,
  ): Promise<ProjectionResult | null> {
    this.logger.log(`[${proposalId}] Fetching Twitter: ${twitterHandle}`);
    try {
      const twData = await this.twitterScraper.scrape(twitterHandle);

      const company = await this.companyRepo.findOne({ where: { proposalId } });
      if (!company) throw new Error(`Company not found for proposal ${proposalId}`);

      const twDataToSave = {
        username: twData.username,
        displayName: twData.displayName,
        followers: twData.followers,
        following: twData.following,
        totalTweets: twData.totalTweets,
        profilePicUrl: twData.profilePicUrl,
        coverPicUrl: twData.coverPicUrl,
        description: twData.description,
        posts: twData.posts,
        twFollowers: twData.twFollowers,
      };
      await this.companyRepo.query(
        `UPDATE proposal_companies SET twitter_data = $1::jsonb WHERE id = $2`,
        [JSON.stringify(twDataToSave, this.sanitizeForJsonb), company.id],
      );

      return await this.saveProjection(proposalId, {
        platform: 'twitter',
        followers: twData.followers,
        posts: twData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
        ambassadorCount,
        ambassadorFollowers,
      }, industry);
    } catch (error) {
      const status = error?.response?.status ?? 'no-http';
      const body = JSON.stringify(error?.response?.data ?? {});
      this.logger.warn(`[${proposalId}] Twitter failed (non-fatal): ${error.message} | status=${status} | body=${body}`);
      return null;
    }
  }

  // ─── TikTok ───────────────────────────────────────────────────────────────

  private async processTikTok(
    proposalId: string,
    _company: ProposalCompany,
    tiktokHandle: string,
    ambassadorCount: number,
    ambassadorFollowers: number,
    industry?: string,
  ): Promise<ProjectionResult | null> {
    this.logger.log(`[${proposalId}] Fetching TikTok: ${tiktokHandle}`);
    try {
      const ttData = await this.tiktokScraper.scrape(tiktokHandle);

      const company = await this.companyRepo.findOne({ where: { proposalId } });
      if (!company) throw new Error(`Company not found for proposal ${proposalId}`);

      const ttDataToSave = {
        username: ttData.username,
        nickname: ttData.nickname,
        followers: ttData.followers,
        totalVideos: ttData.totalVideos,
        avatarUrl: ttData.avatarUrl,
        posts: ttData.posts,
        ttFollowers: ttData.ttFollowers,
      };
      await this.companyRepo.query(
        `UPDATE proposal_companies SET tiktok_data = $1::jsonb WHERE id = $2`,
        [JSON.stringify(ttDataToSave, this.sanitizeForJsonb), company.id],
      );

      return await this.saveProjection(proposalId, {
        platform: 'tiktok',
        followers: ttData.followers,
        posts: ttData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
        ambassadorCount,
        ambassadorFollowers,
      }, industry);
    } catch (error) {
      this.logger.warn(`[${proposalId}] TikTok failed (non-fatal): ${error.message}`);
      return null;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async saveProjection(proposalId: string, data: PlatformData, industry?: string): Promise<ProjectionResult> {
    try {
      this.logger.log(`[${proposalId}] saveProjection START: platform=${data.platform}`);
      const projection = this.analysisService.calculate(data, industry);
      this.logger.log(`[${proposalId}] saveProjection CALC OK: ${projection.classification}`);
      const entity = this.projectionRepo.create({ proposalId, ...projection });
      await this.projectionRepo.save(entity);
      this.logger.log(`[${proposalId}] saveProjection SAVED OK`);
      return projection;
    } catch (err) {
      this.logger.error(`[${proposalId}] saveProjection FAILED: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Normaliza cualquier input de LinkedIn a https://www.linkedin.com/company/{slug}
   * Acepta: URL completa, con/sin https://, con/sin www., con query params, o solo el slug
   */
  private cleanLinkedInUrl(input: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/linkedin\.com\/company\/([^/?#]+)/);
    if (match) return `https://www.linkedin.com/company/${match[1]}`;
    // Si no matchea como URL, asumir que es solo el slug
    const slug = trimmed.replace(/^@/, '').replace(/\//g, '');
    return slug ? `https://www.linkedin.com/company/${slug}` : trimmed;
  }

  /** Replacer para JSON.stringify: elimina surrogates sueltos y null bytes de strings */
  private sanitizeForJsonb(_key: string, value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(/[\uD800-\uDFFF]/g, '').replace(/\u0000/g, '');
    }
    return value;
  }
}
