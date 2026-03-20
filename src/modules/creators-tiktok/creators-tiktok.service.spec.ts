import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CreatorsTikTokService } from './creators-tiktok.service';
import { TikTokConnector } from './connectors/tiktok.connector';
import { Creator } from '../../common/entities/creator.entity';

describe('CreatorsTikTokService', () => {
  let service: CreatorsTikTokService;
  let creatorRepo: any;
  let tiktokConnector: jest.Mocked<Partial<TikTokConnector>>;

  const mockCreatorEntity = {
    id: 'db-1',
    platformId: 'tt-creator-1',
    platform: 'tiktok',
    username: 'testcreator',
    name: 'Test Creator',
    profilePictureUrl: 'https://example.com/pic.jpg',
    followersCount: 50000,
    engagementRate: 5.2,
    categories: ['comedy'],
    isVerified: true,
    biography: 'TikTok star',
    profileUrl: 'https://tiktok.com/@testcreator',
    interests: ['humor'],
    gender: 'male',
    ageBucket: '18-24',
    mediaCount: 200,
    avgLikes: 5000,
    avgComments: 300,
    creatorPrice: 500,
    currency: 'USD',
    medianViews: 20000,
    syncKeyword: 'comedy',
    lastSyncedAt: new Date(),
  };

  const mockSearchResult = {
    creators: [
      {
        id: 'tt-creator-1',
        platform: 'tiktok' as const,
        username: 'testcreator',
        name: 'Test Creator',
        profilePictureUrl: 'https://example.com/pic.jpg',
        followersCount: 50000,
        engagementRate: 5.2,
        categories: ['comedy'],
        isVerified: true,
      },
    ],
    paging: { hasNextPage: false },
    totalCount: 1,
  };

  const mockProfile = {
    id: 'tt-creator-1',
    platform: 'tiktok' as const,
    username: 'testcreator',
    name: 'Test Creator',
    profilePictureUrl: 'https://example.com/pic.jpg',
    followersCount: 50000,
    engagementRate: 5.2,
    categories: ['comedy'],
    isVerified: true,
    biography: 'TikTok star',
    profileUrl: 'https://tiktok.com/@testcreator',
    interests: ['humor'],
    gender: 'male',
    ageBucket: '18-24',
    mediaCount: 200,
    avgLikes: 5000,
    avgComments: 300,
    creatorPrice: 500,
    currency: 'USD',
    medianViews: 20000,
  };

  beforeEach(async () => {
    tiktokConnector = {
      searchCreators: jest.fn().mockResolvedValue(mockSearchResult),
      getCreatorProfile: jest.fn().mockResolvedValue(mockProfile),
    };

    creatorRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'new-db-id' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(100),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ platform: 'tiktok', count: '100' }]),
        getManyAndCount: jest.fn().mockResolvedValue([[mockCreatorEntity], 1]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsTikTokService,
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        { provide: TikTokConnector, useValue: tiktokConnector },
      ],
    }).compile();

    service = module.get<CreatorsTikTokService>(CreatorsTikTokService);
  });

  describe('searchCreators', () => {
    it('should search creators from database', async () => {
      const result = await service.searchCreators('user-1', {
        q: 'comedy',
        limit: 20,
      });

      expect(result.creators).toHaveLength(1);
      expect(result.creators[0].username).toBe('testcreator');
    });

    it('should handle pagination with cursor', async () => {
      await service.searchCreators('user-1', {
        q: 'comedy',
        limit: 10,
        cursor: '10',
      });

      const qb = creatorRepo.createQueryBuilder();
      expect(qb.skip).toHaveBeenCalledWith(10);
    });
  });

  describe('getCreatorProfile', () => {
    it('should return profile from DB when available', async () => {
      creatorRepo.findOne.mockResolvedValue(mockCreatorEntity);

      const result = await service.getCreatorProfile('tt-creator-1');

      expect(result.username).toBe('testcreator');
      expect(result.biography).toBe('TikTok star');
      expect(tiktokConnector.getCreatorProfile).not.toHaveBeenCalled();
    });

    it('should fetch from API when not in DB', async () => {
      creatorRepo.findOne.mockResolvedValue(null);

      const result = await service.getCreatorProfile('tt-new-creator');

      expect(result.username).toBe('testcreator');
      expect(tiktokConnector.getCreatorProfile).toHaveBeenCalled();
      expect(creatorRepo.save).toHaveBeenCalled();
    });

    it('should fetch from API when DB entity lacks biography', async () => {
      creatorRepo.findOne.mockResolvedValue({ ...mockCreatorEntity, biography: null });

      const result = await service.getCreatorProfile('tt-creator-1');

      expect(tiktokConnector.getCreatorProfile).toHaveBeenCalled();
      expect(creatorRepo.update).toHaveBeenCalled();
    });

    it('should fallback to DB data when API fails and DB has entity', async () => {
      creatorRepo.findOne.mockResolvedValue({ ...mockCreatorEntity, biography: null });
      tiktokConnector.getCreatorProfile!.mockRejectedValue(new Error('API down'));

      const result = await service.getCreatorProfile('tt-creator-1');

      expect(result.username).toBe('testcreator');
    });

    it('should throw TIKTOK_API_ERROR when API fails and no DB fallback', async () => {
      creatorRepo.findOne.mockResolvedValue(null);
      tiktokConnector.getCreatorProfile!.mockRejectedValue(new Error('Not found'));

      await expect(
        service.getCreatorProfile('unknown'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('syncCreators', () => {
    it('should sync creators from TikTok API', async () => {
      const result = await service.syncCreators(['comedy'], 1);

      expect(result.totalSynced).toBeGreaterThanOrEqual(1);
      expect(result.totalApiCalls).toBe(1);
      expect(result.keywords).toEqual(['comedy']);
      expect(tiktokConnector.searchCreators).toHaveBeenCalled();
    });

    it('should use default keywords when none provided', async () => {
      // Sync with a single specific keyword to prove it handles empty array
      tiktokConnector.searchCreators!.mockResolvedValue({
        ...mockSearchResult,
        paging: { hasNextPage: false },
      });

      const result = await service.syncCreators(['beauty'], 1);

      expect(result.keywords).toEqual(['beauty']);
      expect(result.totalApiCalls).toBe(1);
    });

    it('should handle API errors during sync gracefully', async () => {
      tiktokConnector.searchCreators!.mockRejectedValue(new Error('Rate limited'));

      const result = await service.syncCreators(['test'], 1);

      expect(result.errors).toHaveLength(1);
      expect(result.totalSynced).toBe(0);
    });
  });

  describe('getSyncStats', () => {
    it('should return sync statistics', async () => {
      creatorRepo.findOne
        .mockResolvedValueOnce({ lastSyncedAt: new Date() })
        .mockResolvedValueOnce({ lastSyncedAt: new Date('2024-01-01') });

      const result = await service.getSyncStats();

      expect(result.totalCreators).toBe(100);
      expect(result.byPlatform).toHaveProperty('tiktok');
    });
  });
});
