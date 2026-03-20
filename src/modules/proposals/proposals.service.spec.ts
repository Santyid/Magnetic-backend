import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { Proposal } from './entities/proposal.entity';
import { ProposalCompany } from './entities/proposal-company.entity';
import { ProposalProjection } from './entities/proposal-projection.entity';
import { ProposalEmployee } from './entities/proposal-employee.entity';
import { LinkedInScraper } from './scrapers/linkedin.scraper';
import { FacebookScraper } from './scrapers/facebook.scraper';
import { InstagramScraper } from './scrapers/instagram.scraper';
import { TikTokScraper } from './scrapers/tiktok.scraper';
import { TwitterScraper } from './scrapers/twitter.scraper';
import { AnalysisService } from './analysis.service';
import { AiService } from '../ai/ai.service';

describe('ProposalsService', () => {
  let service: ProposalsService;
  let proposalRepo: any;
  let companyRepo: any;
  let projectionRepo: any;
  let employeeRepo: any;

  const mockProposal = {
    id: 'proposal-1',
    adminUserId: 'admin-1',
    linkedinCompanyUrl: 'https://www.linkedin.com/company/test-company',
    platforms: ['linkedin'],
    status: 'done',
    progress: 100,
    createdAt: new Date(),
    completedAt: new Date(),
    companyName: 'Test Company',
    aiAnalysis: null,
    company: { name: 'Test Company', logo: 'logo.png', industry: 'Tech', description: 'A test company' },
    employees: [],
    projections: [],
  };

  beforeEach(async () => {
    proposalRepo = {
      create: jest.fn((dto) => ({ ...dto, id: 'new-proposal' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    companyRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      query: jest.fn(),
    };

    projectionRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    employeeRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entities) => Promise.resolve(entities)),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: getRepositoryToken(Proposal), useValue: proposalRepo },
        { provide: getRepositoryToken(ProposalCompany), useValue: companyRepo },
        { provide: getRepositoryToken(ProposalProjection), useValue: projectionRepo },
        { provide: getRepositoryToken(ProposalEmployee), useValue: employeeRepo },
        { provide: LinkedInScraper, useValue: { getCompany: jest.fn(), getCompanyProfile: jest.fn(), getEmployeeFollowers: jest.fn() } },
        { provide: FacebookScraper, useValue: { scrape: jest.fn() } },
        { provide: InstagramScraper, useValue: { scrape: jest.fn() } },
        { provide: TikTokScraper, useValue: { scrape: jest.fn() } },
        { provide: TwitterScraper, useValue: { scrape: jest.fn() } },
        { provide: AnalysisService, useValue: { calculate: jest.fn(), calculateAdvocacyScore: jest.fn() } },
        { provide: AiService, useValue: { analyzeProposal: jest.fn(), identifyCompetitors: jest.fn(), analyzeCompetitorBrand: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProposalsService>(ProposalsService);
  });

  describe('create', () => {
    it('should create a proposal with pending status', async () => {
      proposalRepo.save.mockResolvedValue({ id: 'new-proposal', status: 'pending' });

      const result = await service.create('admin-1', {
        linkedinCompanyUrl: 'https://linkedin.com/company/test',
        platforms: ['linkedin'],
      });

      expect(proposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          status: 'pending',
        }),
      );
      expect(proposalRepo.save).toHaveBeenCalled();
    });

    it('should normalize LinkedIn URL', async () => {
      proposalRepo.save.mockResolvedValue({ id: 'new-proposal', status: 'pending' });

      await service.create('admin-1', {
        linkedinCompanyUrl: 'linkedin.com/company/test?trk=param',
        platforms: ['linkedin'],
      });

      expect(proposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          linkedinCompanyUrl: 'https://www.linkedin.com/company/test',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return proposals for admin user', async () => {
      proposalRepo.find.mockResolvedValue([mockProposal]);

      const result = await service.findAll('admin-1');

      expect(result).toHaveLength(1);
      expect(result[0].companyName).toBe('Test Company');
      expect(proposalRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adminUserId: 'admin-1' } }),
      );
    });

    it('should return empty array when no proposals', async () => {
      proposalRepo.find.mockResolvedValue([]);

      const result = await service.findAll('admin-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return proposal with relations', async () => {
      proposalRepo.findOne.mockResolvedValue(mockProposal);

      const result = await service.findOne('proposal-1', 'admin-1');

      expect(result.id).toBe('proposal-1');
      expect(proposalRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'proposal-1', adminUserId: 'admin-1' },
        relations: ['company', 'employees', 'projections'],
      });
    });

    it('should throw PROPOSAL_NOT_FOUND when not found', async () => {
      proposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatus', () => {
    it('should return proposal status and progress', async () => {
      proposalRepo.findOne.mockResolvedValue({
        id: 'proposal-1',
        status: 'processing',
        progress: 50,
        completedAt: null,
      });

      const result = await service.getStatus('proposal-1', 'admin-1');

      expect(result.status).toBe('processing');
      expect(result.progress).toBe(50);
    });

    it('should throw PROPOSAL_NOT_FOUND when not found', async () => {
      proposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getStatus('nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove proposal', async () => {
      proposalRepo.findOne.mockResolvedValue(mockProposal);

      await service.remove('proposal-1', 'admin-1');

      expect(proposalRepo.remove).toHaveBeenCalledWith(mockProposal);
    });

    it('should throw PROPOSAL_NOT_FOUND when not found', async () => {
      proposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAiAnalysis', () => {
    it('should return cached AI analysis if exists', async () => {
      proposalRepo.findOne.mockResolvedValue({
        ...mockProposal,
        aiAnalysis: '{"summary":"cached analysis"}',
      });

      const result = await service.getAiAnalysis('proposal-1', 'admin-1');

      expect(result).toEqual({ summary: 'cached analysis' });
    });

    it('should generate new AI analysis when not cached', async () => {
      proposalRepo.findOne.mockResolvedValue({ ...mockProposal, aiAnalysis: null });
      const aiService = service['aiService'] as jest.Mocked<AiService>;
      (aiService.analyzeProposal as jest.Mock).mockResolvedValue({ summary: 'new analysis' });
      proposalRepo.update.mockResolvedValue(undefined);

      const result = await service.getAiAnalysis('proposal-1', 'admin-1');

      expect(result).toEqual({ summary: 'new analysis' });
      expect(proposalRepo.update).toHaveBeenCalled();
    });

    it('should throw PROPOSAL_NOT_FOUND when not found', async () => {
      proposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getAiAnalysis('nonexistent', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
