import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';

// Mock OpenAI
const mockCreate = jest.fn().mockResolvedValue({
  choices: [{ message: { content: 'AI response' } }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
});
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

describe('AiService', () => {
  let service: AiService;
  let productsService: jest.Mocked<Partial<ProductsService>>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const mockUser = {
    id: 'user-1',
    email: 'test@magnetic.com',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          'openai.apiKey': 'test-api-key',
          'openai.model': 'gpt-4o-mini',
          'openai.maxTokens': '500',
        };
        return config[key];
      }),
    } as unknown as ConfigService;

    productsService = {
      findUserProducts: jest.fn().mockResolvedValue([
        { product: { name: 'SocialGest', description: 'Social media' } },
      ]),
    };

    usersService = {
      findOne: jest.fn().mockResolvedValue(mockUser),
    };

    service = new AiService(
      configService,
      productsService as any,
      usersService as any,
    );
  });

  describe('chat', () => {
    it('should return AI response with usage stats', async () => {
      const result = await service.chat('user-1', {
        message: 'Hello',
      });

      expect(result.reply).toBe('AI response');
      expect(result.usage.totalTokens).toBe(30);
    });

    it('should include history in messages when provided', async () => {
      const result = await service.chat('user-1', {
        message: 'Follow up',
        history: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
        ],
      });

      expect(result.reply).toBeDefined();
    });

    it('should throw 429 when rate limit exceeded', async () => {
      // Exhaust rate limit (20 messages per hour)
      for (let i = 0; i < 20; i++) {
        await service.chat('rate-limited-user', { message: `msg ${i}` });
      }

      await expect(
        service.chat('rate-limited-user', { message: 'one more' }),
      ).rejects.toThrow(HttpException);

      try {
        await service.chat('rate-limited-user', { message: 'one more' });
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should have independent rate limits per user', async () => {
      // Fill one user's limit
      for (let i = 0; i < 20; i++) {
        await service.chat('user-A', { message: `msg ${i}` });
      }

      // Different user should still work
      const result = await service.chat('user-B', { message: 'hello' });
      expect(result.reply).toBeDefined();
    });
  });

  describe('identifyCompetitors', () => {
    it('should return array of competitor slugs', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"slugs":["competitor-1","competitor-2"]}' } }],
      });

      const result = await service.identifyCompetitors('Bancolombia', 'Financial Services', 'Colombia');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('analyzeProposal', () => {
    it('should return analysis object', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"summary":"Test analysis","keyBenefits":[],"callToAction":"Demo now"}' } }],
      });

      const result = await service.analyzeProposal({
        company: { name: 'TestCo', industry: 'Tech', employeeCount: 100 },
        projections: [],
      });

      expect(result).toHaveProperty('summary');
    });
  });

  describe('analyzeCompetitorBrand', () => {
    it('should return brand analysis object', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"brandPosition":"Leader","strengths":[],"weaknesses":[],"opportunities":[],"competitorInsights":[],"recommendation":"Use Adpro"}' } }],
      });

      const result = await service.analyzeCompetitorBrand({
        company: { name: 'TestCo', followers: 10000, employeeCount: 100, industry: 'Tech', engagement: { avgLikes: 50, avgComments: 10, engagementRate: 0.5, postsPerMonth: 12 } },
        competitors: [],
      });

      expect(result).toHaveProperty('brandPosition');
    });
  });
});
