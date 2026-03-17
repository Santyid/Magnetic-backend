import { AnalysisService, PlatformData, ProjectionResult } from './analysis.service';

describe('AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(() => {
    service = new AnalysisService();
  });

  describe('calculate', () => {
    const basePlatformData: PlatformData = {
      platform: 'linkedin',
      followers: 10000,
      posts: [
        { likes: 50, comments: 10, reposts: 5 },
        { likes: 30, comments: 8, reposts: 3 },
        { likes: 70, comments: 15, reposts: 10 },
      ],
      ambassadorCount: 20,
      ambassadorFollowers: 5000,
    };

    it('should calculate projection for LinkedIn', () => {
      const result = service.calculate(basePlatformData);

      expect(result.platform).toBe('linkedin');
      expect(result.followers).toBe(10000);
      expect(result.currentAvgLikes).toBeGreaterThan(0);
      expect(result.currentAvgComments).toBeGreaterThan(0);
      expect(result.currentER).toBeGreaterThan(0);
      expect(result.growthFactor).toBeGreaterThanOrEqual(1);
      expect(result.potentialReach).toBe(15000); // 10000 + 5000
      expect(result.ambassadorCount).toBe(20);
      expect(result.ambassadorFollowers).toBe(5000);
    });

    it('should cap growth factor at platform maximum', () => {
      const data: PlatformData = {
        ...basePlatformData,
        followers: 100,
        ambassadorFollowers: 100000, // Huge ratio
      };

      const result = service.calculate(data);

      expect(result.growthFactor).toBeLessThanOrEqual(5.0); // LinkedIn max
    });

    it('should classify engagement correctly', () => {
      // LOW ER compared to benchmark → HIGH growth opportunity
      const lowER: PlatformData = {
        ...basePlatformData,
        followers: 100000,
        posts: [{ likes: 5, comments: 1, reposts: 0 }],
      };

      const result = service.calculate(lowER);

      expect(result.classification).toBe('HIGH');
    });

    it('should handle zero followers', () => {
      const data: PlatformData = {
        ...basePlatformData,
        followers: 0,
        posts: [{ likes: 10, comments: 2, reposts: 1 }],
      };

      const result = service.calculate(data);

      expect(result.currentER).toBe(0);
      expect(result.followers).toBe(0);
    });

    it('should handle empty posts', () => {
      const data: PlatformData = {
        ...basePlatformData,
        posts: [],
      };

      const result = service.calculate(data);

      expect(result.currentAvgLikes).toBe(0);
      expect(result.currentAvgComments).toBe(0);
      expect(result.currentER).toBe(0);
    });

    it('should calculate earned media value', () => {
      const result = service.calculate(basePlatformData);

      expect(result.earnedMediaValue).toBeGreaterThan(0);
      expect(result.estimatedImpressions).toBeGreaterThan(0);
      expect(result.costPerImpression).toBeGreaterThan(0);
    });

    it('should use industry benchmarks when provided', () => {
      const result = service.calculate(basePlatformData, 'banking');

      expect(result.industryLabel).toBe('Financial services');
      expect(result.industryBenchmarkER).toBeGreaterThan(0);
    });

    it('should fallback to general benchmarks without industry', () => {
      const result = service.calculate(basePlatformData);

      expect(result.industryLabel).toBe('General');
    });

    it('should generate recommendations', () => {
      const result = service.calculate(basePlatformData);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate for different platforms', () => {
      const platforms = ['instagram', 'facebook', 'twitter', 'tiktok'];

      for (const platform of platforms) {
        const data: PlatformData = { ...basePlatformData, platform };
        const result = service.calculate(data);

        expect(result.platform).toBe(platform);
        expect(result.earnedMediaValue).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateAdvocacyScore', () => {
    const mockProjections: ProjectionResult[] = [
      {
        platform: 'linkedin',
        followers: 10000,
        currentAvgLikes: 50,
        currentAvgComments: 10,
        currentER: 0.65,
        projectedLikes: 75,
        projectedER: 0.97,
        growthFactor: 1.5,
        ambassadorCount: 20,
        ambassadorFollowers: 5000,
        potentialReach: 15000,
        classification: 'MEDIUM',
        recommendations: [],
        earnedMediaValue: 500,
        costPerImpression: 8.5,
        estimatedImpressions: 6000,
        industryBenchmarkER: 0.35,
        erVsBenchmark: 85,
        industryLabel: 'Technology',
      },
    ];

    it('should return score between 0 and 100', () => {
      const result = service.calculateAdvocacyScore(
        mockProjections, 20, 5000, 10000, 500, 5,
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return breakdown with 5 categories', () => {
      const result = service.calculateAdvocacyScore(
        mockProjections, 20, 5000, 10000, 500, 5,
      );

      expect(result.breakdown).toHaveLength(5);
      const categories = result.breakdown.map((b) => b.category);
      expect(categories).toContain('teamSize');
      expect(categories).toContain('employeeReach');
      expect(categories).toContain('multiPlatform');
      expect(categories).toContain('growthOpportunity');
      expect(categories).toContain('contentActivity');
    });

    it('should give higher team score for more employees', () => {
      const small = service.calculateAdvocacyScore(mockProjections, 5, 500, 10000, 10, 5);
      const large = service.calculateAdvocacyScore(mockProjections, 20, 5000, 10000, 1000, 5);

      const smallTeam = small.breakdown.find((b) => b.category === 'teamSize')!.score;
      const largeTeam = large.breakdown.find((b) => b.category === 'teamSize')!.score;

      expect(largeTeam).toBeGreaterThan(smallTeam);
    });

    it('should give higher platform score for more platforms', () => {
      const single = service.calculateAdvocacyScore(
        [mockProjections[0]], 20, 5000, 10000, 500, 5,
      );
      const multi = service.calculateAdvocacyScore(
        [...mockProjections, { ...mockProjections[0], platform: 'instagram' }, { ...mockProjections[0], platform: 'facebook' }],
        20, 5000, 10000, 500, 5,
      );

      const singleScore = single.breakdown.find((b) => b.category === 'multiPlatform')!.score;
      const multiScore = multi.breakdown.find((b) => b.category === 'multiPlatform')!.score;

      expect(multiScore).toBeGreaterThan(singleScore);
    });

    it('should handle zero employees', () => {
      const result = service.calculateAdvocacyScore(mockProjections, 0, 0, 10000, 0, 0);

      expect(result.score).toBeGreaterThanOrEqual(0);
      const teamScore = result.breakdown.find((b) => b.category === 'teamSize')!.score;
      expect(teamScore).toBe(0);
    });

    it('should handle empty projections', () => {
      const result = service.calculateAdvocacyScore([], 20, 5000, 10000, 500, 5);

      expect(result.score).toBeGreaterThanOrEqual(0);
      const platformScore = result.breakdown.find((b) => b.category === 'multiPlatform')!.score;
      expect(platformScore).toBe(0);
    });
  });
});
