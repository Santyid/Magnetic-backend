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
import { AnalysisService, PlatformData } from './analysis.service';
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

  async getStatus(id: string, adminUserId: string): Promise<{ status: string; completedAt?: Date }> {
    const proposal = await this.proposalRepo.findOne({
      where: { id, adminUserId },
      select: ['id', 'status', 'completedAt', 'errorMessage'],
    });

    if (!proposal) throw new NotFoundException('PROPOSAL_NOT_FOUND');
    return { status: proposal.status, completedAt: proposal.completedAt };
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
    await this.proposalRepo.update(proposalId, { status: 'processing' });
    const platforms = dto.platforms?.length ? dto.platforms : [];

    try {
      // ── 0. Limpiar URL de LinkedIn ──────────────────────────────────────
      const cleanUrl = this.cleanLinkedInUrl(dto.linkedinCompanyUrl);

      // ── 1. LinkedIn (scraper real via RapidAPI) ────────────────────────
      const liData = await this.linkedInScraper.getCompany(cleanUrl);
      this.logger.log(`[${proposalId}] LinkedIn scraped: ${liData.name} (${liData.followers} followers, ${liData.employees.length} employees)`);

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

      if (liData.employees.length > 0) {
        const top20 = liData.employees.slice(0, 20);
        const followerResults = await Promise.allSettled(
          top20.map((e) => this.linkedInScraper.getEmployeeFollowers(e.publicIdentifier)),
        );

        const employeeEntities: ProposalEmployee[] = [];
        for (let i = 0; i < top20.length; i++) {
          const emp = top20[i];
          const result = followerResults[i];
          const followers = result.status === 'fulfilled' ? result.value : 0;
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
        this.logger.log(`[${proposalId}] Saved ${ambassadorCount} employees, total followers: ${ambassadorFollowers}`);
      }

      // ── 3. Proyección LinkedIn (solo si tiene datos y está en platforms) ──
      if (platforms.includes('linkedin') && liData.followers > 0) {
        await this.saveProjection(proposalId, {
          platform: 'linkedin',
          followers: liData.followers,
          posts: liData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
          ambassadorCount,
          ambassadorFollowers,
        });
      }

      // ── 4. Facebook (opcional) ───────────────────────────────────────────
      if (platforms.includes('facebook') && dto.facebookUrl) {
        await this.processFacebook(
          proposalId, company, dto.facebookUrl,
          ambassadorCount, ambassadorFollowers,
        );
      }

      // ── 5. Instagram (opcional) ──────────────────────────────────────────
      this.logger.log(`[${proposalId}] Instagram check: platforms=${JSON.stringify(platforms)}, handle="${dto.instagramHandle}"`);
      if (platforms.includes('instagram') && dto.instagramHandle) {
        await this.processInstagram(
          proposalId, company, dto.instagramHandle,
          ambassadorCount, ambassadorFollowers,
        );
      }

      // ── 6. TikTok (opcional) ─────────────────────────────────────────────
      if (platforms.includes('tiktok') && dto.tiktokHandle) {
        await this.processTikTok(
          proposalId, company, dto.tiktokHandle,
          ambassadorCount, ambassadorFollowers,
        );
      }

      // ── 7. Twitter/X (opcional) ──────────────────────────────────────────
      if (platforms.includes('twitter') && dto.twitterHandle) {
        await this.processTwitter(
          proposalId, company, dto.twitterHandle,
          ambassadorCount, ambassadorFollowers,
        );
      }

      // ── 8. Completado ────────────────────────────────────────────────────
      await this.proposalRepo.update(proposalId, {
        status: 'done',
        completedAt: new Date(),
      });

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
  ): Promise<void> {
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

      await this.saveProjection(proposalId, {
        platform: 'facebook',
        followers: projectionFollowers,
        posts: fbData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
        ambassadorCount,
        ambassadorFollowers,
      });
    } catch (error) {
      this.logger.warn(`[${proposalId}] Facebook failed (non-fatal): ${error.message}`);
    }
  }

  // ─── Instagram ────────────────────────────────────────────────────────────

  private async processInstagram(
    proposalId: string,
    _company: ProposalCompany,
    instagramHandle: string,
    ambassadorCount: number,
    ambassadorFollowers: number,
  ): Promise<void> {
    this.logger.log(`[${proposalId}] Fetching Instagram: ${instagramHandle}`);
    try {
      const igData = await this.instagramScraper.scrape(instagramHandle);
      this.logger.log(`[${proposalId}] Instagram scraped OK: ${igData.followers} followers, ${igData.posts.length} posts, ${igData.igFollowers?.length ?? 0} igFollowers`);

      // Re-fetch company by proposalId to guarantee a valid DB-assigned id
      const company = await this.companyRepo.findOne({ where: { proposalId } });
      if (!company) throw new Error(`Company not found for proposal ${proposalId}`);
      this.logger.log(`[${proposalId}] Company found: id=${company.id}`);

      // Guardar proyección PRIMERO (antes del UPDATE con JSON grande que trunca logs)
      await this.saveProjection(proposalId, {
        platform: 'instagram',
        followers: igData.followers,
        posts: igData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts ?? 0 })),
        ambassadorCount,
        ambassadorFollowers,
      });
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
    } catch (error) {
      const status = error?.response?.status ?? 'no-http';
      const body = JSON.stringify(error?.response?.data ?? {});
      this.logger.warn(`[${proposalId}] Instagram failed (non-fatal): ${error.message} | status=${status} | body=${body}`);
    }
  }

  // ─── Twitter ──────────────────────────────────────────────────────────────

  private async processTwitter(
    proposalId: string,
    _company: ProposalCompany,
    twitterHandle: string,
    ambassadorCount: number,
    ambassadorFollowers: number,
  ): Promise<void> {
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

      await this.saveProjection(proposalId, {
        platform: 'twitter',
        followers: twData.followers,
        posts: twData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
        ambassadorCount,
        ambassadorFollowers,
      });
    } catch (error) {
      const status = error?.response?.status ?? 'no-http';
      const body = JSON.stringify(error?.response?.data ?? {});
      this.logger.warn(`[${proposalId}] Twitter failed (non-fatal): ${error.message} | status=${status} | body=${body}`);
    }
  }

  // ─── TikTok ───────────────────────────────────────────────────────────────

  private async processTikTok(
    proposalId: string,
    _company: ProposalCompany,
    tiktokHandle: string,
    ambassadorCount: number,
    ambassadorFollowers: number,
  ): Promise<void> {
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

      await this.saveProjection(proposalId, {
        platform: 'tiktok',
        followers: ttData.followers,
        posts: ttData.posts.map((p) => ({ likes: p.likes, comments: p.comments, reposts: p.reposts })),
        ambassadorCount,
        ambassadorFollowers,
      });
    } catch (error) {
      this.logger.warn(`[${proposalId}] TikTok failed (non-fatal): ${error.message}`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async saveProjection(proposalId: string, data: PlatformData): Promise<void> {
    try {
      this.logger.log(`[${proposalId}] saveProjection START: platform=${data.platform}`);
      const projection = this.analysisService.calculate(data);
      this.logger.log(`[${proposalId}] saveProjection CALC OK: ${projection.classification}`);
      const entity = this.projectionRepo.create({ proposalId, ...projection });
      await this.projectionRepo.save(entity);
      this.logger.log(`[${proposalId}] saveProjection SAVED OK`);
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
