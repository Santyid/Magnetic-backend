import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ProductsService } from '../products/products.service';
import { AdvocatesConnector } from './connectors/advocates.connector';

describe('DashboardService', () => {
  let service: DashboardService;
  let productsService: jest.Mocked<Partial<ProductsService>>;
  let advocatesConnector: jest.Mocked<Partial<AdvocatesConnector>>;

  const mockUserProduct = {
    id: 'up-1',
    userId: 'user-1',
    productId: 'prod-1',
    externalUserId: 'ext-1',
    customDomain: 'qa.advocatespro.com',
    productEmail: 'admin_adpro_dev',
    encryptedPassword: 'encrypted-value',
    apiToken: null,
    enableMetrics: true,
    metadata: {},
    isActive: true,
    createdAt: new Date(),
    product: {
      id: 'prod-1',
      name: 'Advocates',
      slug: 'advocates',
      baseUrl: 'https://advocates.com',
      logoUrl: null,
      description: 'Advocacy platform',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      userProducts: [],
    },
    user: null,
  };

  const mockMetrics = {
    data: {
      acumulateValuation: '50718391.29',
      totalEngagement: 285,
      totalContent: 715,
      totalPotentialReach: 331599,
      totalEstimatedReach: 63809,
    },
  };

  beforeEach(async () => {
    productsService = {
      findUserProducts: jest.fn(),
      saveCredentials: jest.fn(),
      deleteCredentials: jest.fn(),
      getDecryptedCredentials: jest.fn(),
      updateProductAssignment: jest.fn(),
    };

    advocatesConnector = {
      authenticate: jest.fn(),
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: ProductsService, useValue: productsService },
        { provide: AdvocatesConnector, useValue: advocatesConnector },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('connectProduct', () => {
    it('should connect Advocates product successfully', async () => {
      productsService.findUserProducts.mockResolvedValue([mockUserProduct as any]);
      advocatesConnector.authenticate.mockResolvedValue({
        token: 'jwt-token',
        expiresAt: Date.now() + 86400000,
      });
      productsService.saveCredentials.mockResolvedValue(mockUserProduct as any);

      const result = await service.connectProduct('user-1', 'up-1', {
        productEmail: 'admin_adpro_dev',
        password: 'AD_adpro_2022',
        subdomain: 'qa',
      });

      expect(result.connected).toBe(true);
      expect(result.message).toBe('PRODUCT_CONNECTED_SUCCESSFULLY');
      expect(result.product.slug).toBe('advocates');
      expect(advocatesConnector.authenticate).toHaveBeenCalledWith(
        'admin_adpro_dev',
        'AD_adpro_2022',
        'qa',
      );
      expect(productsService.saveCredentials).toHaveBeenCalledWith('up-1', {
        productEmail: 'admin_adpro_dev',
        password: 'AD_adpro_2022',
        enableMetrics: true,
      });
    });

    it('should throw INVALID_PRODUCT_CREDENTIALS when auth fails', async () => {
      productsService.findUserProducts.mockResolvedValue([mockUserProduct as any]);
      advocatesConnector.authenticate.mockRejectedValue(
        new Error('ADVOCATES_AUTH_FAILED'),
      );

      await expect(
        service.connectProduct('user-1', 'up-1', {
          productEmail: 'bad-user',
          password: 'bad-pass',
          subdomain: 'qa',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw PRODUCT_NOT_FOUND when product not assigned', async () => {
      productsService.findUserProducts.mockResolvedValue([]);

      await expect(
        service.connectProduct('user-1', 'nonexistent', {
          productEmail: 'user',
          password: 'pass',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should save credentials for non-advocates products without validation', async () => {
      const socialGestProduct = {
        ...mockUserProduct,
        id: 'up-2',
        product: { ...mockUserProduct.product, slug: 'socialgest', name: 'SocialGest' },
      };
      productsService.findUserProducts.mockResolvedValue([socialGestProduct as any]);
      productsService.saveCredentials.mockResolvedValue(socialGestProduct as any);

      const result = await service.connectProduct('user-1', 'up-2', {
        productEmail: 'user@socialgest.com',
        password: 'pass123',
      });

      expect(result.connected).toBe(true);
      expect(result.message).toBe('CREDENTIALS_SAVED');
      expect(advocatesConnector.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('disconnectProduct', () => {
    it('should disconnect product and clear credentials', async () => {
      productsService.findUserProducts.mockResolvedValue([mockUserProduct as any]);
      productsService.deleteCredentials.mockResolvedValue(mockUserProduct as any);

      const result = await service.disconnectProduct('user-1', 'up-1');

      expect(result.connected).toBe(false);
      expect(result.message).toBe('PRODUCT_DISCONNECTED_SUCCESSFULLY');
      expect(productsService.deleteCredentials).toHaveBeenCalledWith('up-1');
    });

    it('should throw PRODUCT_NOT_FOUND for unknown product', async () => {
      productsService.findUserProducts.mockResolvedValue([]);

      await expect(
        service.disconnectProduct('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for connected Advocates product', async () => {
      productsService.findUserProducts.mockResolvedValue([mockUserProduct as any]);
      productsService.getDecryptedCredentials.mockReturnValue({
        productEmail: 'admin_adpro_dev',
        password: 'AD_adpro_2022',
      });
      advocatesConnector.authenticate.mockResolvedValue({
        token: 'jwt-token',
        expiresAt: Date.now() + 86400000,
      });
      advocatesConnector.getMetrics.mockResolvedValue(mockMetrics);

      const result = await service.getMetrics('user-1');

      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0].productSlug).toBe('advocates');
      expect(result.metrics[0].metrics).toEqual(mockMetrics);
    });

    it('should return empty metrics when no products have enableMetrics', async () => {
      const noMetricsProduct = {
        ...mockUserProduct,
        enableMetrics: false,
        encryptedPassword: null,
      };
      productsService.findUserProducts.mockResolvedValue([noMetricsProduct as any]);

      const result = await service.getMetrics('user-1');

      expect(result.metrics).toHaveLength(0);
    });

    it('should return error for products with missing credentials', async () => {
      const noCredsProduct = {
        ...mockUserProduct,
        productEmail: null,
        encryptedPassword: 'encrypted',
        enableMetrics: true,
      };
      productsService.findUserProducts.mockResolvedValue([noCredsProduct as any]);
      productsService.getDecryptedCredentials.mockReturnValue({
        productEmail: null,
        password: 'decrypted',
      });

      const result = await service.getMetrics('user-1');

      expect(result.metrics[0].error).toBe('MISSING_CREDENTIALS');
    });

    it('should return CONNECTOR_NOT_IMPLEMENTED for non-advocates products', async () => {
      const tikketProduct = {
        ...mockUserProduct,
        product: { ...mockUserProduct.product, slug: 'tikket', name: 'Tikket' },
      };
      productsService.findUserProducts.mockResolvedValue([tikketProduct as any]);
      productsService.getDecryptedCredentials.mockReturnValue({
        productEmail: 'user',
        password: 'pass',
      });

      const result = await service.getMetrics('user-1');

      expect(result.metrics[0].error).toBe('CONNECTOR_NOT_IMPLEMENTED');
    });
  });

  describe('syncProduct', () => {
    it('should sync Advocates metrics', async () => {
      productsService.findUserProducts.mockResolvedValue([mockUserProduct as any]);
      productsService.getDecryptedCredentials.mockReturnValue({
        productEmail: 'admin_adpro_dev',
        password: 'AD_adpro_2022',
      });
      advocatesConnector.authenticate.mockResolvedValue({
        token: 'jwt-token',
        expiresAt: Date.now() + 86400000,
      });
      advocatesConnector.getMetrics.mockResolvedValue(mockMetrics);

      const result = await service.syncProduct('user-1', 'up-1');

      expect(result.productSlug).toBe('advocates');
      expect(result.metrics).toEqual(mockMetrics);
    });

    it('should return error for unknown userProductId', async () => {
      productsService.findUserProducts.mockResolvedValue([mockUserProduct as any]);

      const result = await service.syncProduct('user-1', 'nonexistent');

      expect(result.error).toBe('PRODUCT_NOT_FOUND_OR_METRICS_DISABLED');
    });
  });
});
