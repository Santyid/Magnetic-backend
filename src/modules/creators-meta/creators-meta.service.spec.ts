import { HttpException, HttpStatus } from '@nestjs/common';
import { CreatorsMetaService } from './creators-meta.service';
import { MetaConnector } from './connectors/meta.connector';

describe('CreatorsMetaService', () => {
  let service: CreatorsMetaService;
  let metaConnector: jest.Mocked<Partial<MetaConnector>>;

  const mockSearchResult = {
    creators: [
      {
        id: 'creator-1',
        platform: 'facebook' as const,
        username: 'testcreator',
        name: 'Test Creator',
        profilePictureUrl: 'https://example.com/pic.jpg',
        followersCount: 10000,
        engagementRate: 3.5,
        categories: ['lifestyle'],
        isVerified: true,
      },
    ],
    paging: { hasNextPage: false },
    totalCount: 1,
  };

  const mockProfile = {
    id: 'creator-1',
    platform: 'facebook' as const,
    username: 'testcreator',
    name: 'Test Creator',
    profilePictureUrl: 'https://example.com/pic.jpg',
    followersCount: 10000,
    engagementRate: 3.5,
    categories: ['lifestyle'],
    isVerified: true,
    biography: 'Test bio',
    profileUrl: 'https://facebook.com/testcreator',
    interests: ['fashion'],
  };

  beforeEach(() => {
    metaConnector = {
      searchCreators: jest.fn().mockResolvedValue(mockSearchResult),
      getCreatorProfile: jest.fn().mockResolvedValue(mockProfile),
    };

    service = new CreatorsMetaService(metaConnector as any);
  });

  describe('searchCreators', () => {
    it('should return search results', async () => {
      const result = await service.searchCreators('user-1', {
        q: 'lifestyle',
        platform: 'facebook',
      });

      expect(result.creators).toHaveLength(1);
      expect(metaConnector.searchCreators).toHaveBeenCalledWith('lifestyle', 'facebook', 20, undefined);
    });

    it('should use cached results on subsequent calls', async () => {
      await service.searchCreators('user-1', { q: 'lifestyle', platform: 'facebook' });
      await service.searchCreators('user-1', { q: 'lifestyle', platform: 'facebook' });

      expect(metaConnector.searchCreators).toHaveBeenCalledTimes(1);
    });

    it('should throw 429 when rate limit exceeded', async () => {
      // Directly set the rate limit map to simulate exhausted limit
      const rateLimitMap = (service as any).rateLimitMap;
      rateLimitMap.set('rate-user:meta', {
        count: 100,
        resetAt: new Date(Date.now() + 3600000),
      });

      await expect(
        service.searchCreators('rate-user', { q: 'one-more', platform: 'facebook' }),
      ).rejects.toThrow(HttpException);
    });

    it('should wrap non-HttpException errors as META_API_ERROR', async () => {
      metaConnector.searchCreators!.mockRejectedValue(new Error('Network error'));

      await expect(
        service.searchCreators('user-1', { q: 'test', platform: 'facebook' }),
      ).rejects.toThrow(HttpException);

      try {
        await service.searchCreators('user-2', { q: 'test', platform: 'facebook' });
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      }
    });

    it('should re-throw HttpExceptions as-is', async () => {
      const httpError = new HttpException('RATE_LIMIT', HttpStatus.TOO_MANY_REQUESTS);
      metaConnector.searchCreators!.mockRejectedValue(httpError);

      await expect(
        service.searchCreators('user-1', { q: 'test', platform: 'facebook' }),
      ).rejects.toThrow(httpError);
    });
  });

  describe('getCreatorProfile', () => {
    it('should return creator profile', async () => {
      const result = await service.getCreatorProfile('creator-1', 'facebook');

      expect(result.id).toBe('creator-1');
      expect(result.biography).toBe('Test bio');
    });

    it('should cache profile results', async () => {
      await service.getCreatorProfile('creator-1', 'facebook');
      await service.getCreatorProfile('creator-1', 'facebook');

      expect(metaConnector.getCreatorProfile).toHaveBeenCalledTimes(1);
    });

    it('should wrap errors as META_API_ERROR', async () => {
      metaConnector.getCreatorProfile!.mockRejectedValue(new Error('Not found'));

      await expect(
        service.getCreatorProfile('bad-id', 'facebook'),
      ).rejects.toThrow(HttpException);
    });
  });
});
