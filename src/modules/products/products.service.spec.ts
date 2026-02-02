import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { UserProduct } from './entities/user-product.entity';
import { EncryptionService } from '../../common/services/encryption.service';

describe('ProductsService - Credentials', () => {
  let service: ProductsService;
  let encryptionService: jest.Mocked<Partial<EncryptionService>>;
  let userProductRepo: any;

  const mockUserProduct = {
    id: 'up-1',
    userId: 'user-1',
    productId: 'prod-1',
    externalUserId: 'ext-1',
    customDomain: null,
    productEmail: null,
    encryptedPassword: null,
    apiToken: null,
    enableMetrics: false,
    metadata: {},
    isActive: true,
    createdAt: new Date(),
    product: {
      id: 'prod-1',
      name: 'Advocates',
      slug: 'advocates',
      baseUrl: 'https://advocates.com',
    },
    user: { id: 'user-1', email: 'demo@magnetic.com' },
  };

  beforeEach(async () => {
    encryptionService = {
      encrypt: jest.fn((val) => `encrypted:${val}`),
      decrypt: jest.fn((val) => val.replace('encrypted:', '')),
    };

    userProductRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(UserProduct), useValue: userProductRepo },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EncryptionService, useValue: encryptionService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('saveCredentials', () => {
    it('should encrypt password and save', async () => {
      userProductRepo.findOne.mockResolvedValue({ ...mockUserProduct });

      const result = await service.saveCredentials('up-1', {
        productEmail: 'admin_adpro_dev',
        password: 'AD_adpro_2022',
        enableMetrics: true,
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('AD_adpro_2022');
      expect(result.productEmail).toBe('admin_adpro_dev');
      expect(result.encryptedPassword).toBe('encrypted:AD_adpro_2022');
      expect(result.enableMetrics).toBe(true);
    });

    it('should encrypt apiToken when provided', async () => {
      userProductRepo.findOne.mockResolvedValue({ ...mockUserProduct });

      await service.saveCredentials('up-1', {
        apiToken: 'my-api-token',
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('my-api-token');
    });

    it('should throw NotFoundException for invalid userProductId', async () => {
      userProductRepo.findOne.mockResolvedValue(null);

      await expect(
        service.saveCredentials('nonexistent', { productEmail: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only update provided fields', async () => {
      const existing = {
        ...mockUserProduct,
        productEmail: 'old@email.com',
        encryptedPassword: 'old-encrypted',
        enableMetrics: true,
      };
      userProductRepo.findOne.mockResolvedValue({ ...existing });

      const result = await service.saveCredentials('up-1', {
        productEmail: 'new@email.com',
      });

      expect(result.productEmail).toBe('new@email.com');
      // Password should remain unchanged since we didn't pass it
      expect(result.encryptedPassword).toBe('old-encrypted');
    });
  });

  describe('deleteCredentials', () => {
    it('should clear all credential fields', async () => {
      userProductRepo.findOne.mockResolvedValue({
        ...mockUserProduct,
        productEmail: 'admin',
        encryptedPassword: 'encrypted',
        apiToken: 'token',
        enableMetrics: true,
      });

      const result = await service.deleteCredentials('up-1');

      expect(result.productEmail).toBeNull();
      expect(result.encryptedPassword).toBeNull();
      expect(result.apiToken).toBeNull();
      expect(result.enableMetrics).toBe(false);
    });

    it('should throw NotFoundException for invalid userProductId', async () => {
      userProductRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteCredentials('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDecryptedCredentials', () => {
    it('should decrypt password and apiToken', () => {
      const up = {
        ...mockUserProduct,
        productEmail: 'admin_adpro_dev',
        encryptedPassword: 'encrypted:AD_adpro_2022',
        apiToken: 'encrypted:my-token',
      } as any;

      const result = service.getDecryptedCredentials(up);

      expect(result.productEmail).toBe('admin_adpro_dev');
      expect(result.password).toBe('AD_adpro_2022');
      expect(result.apiToken).toBe('my-token');
    });

    it('should return undefined for null fields', () => {
      const up = {
        ...mockUserProduct,
        productEmail: null,
        encryptedPassword: null,
        apiToken: null,
      } as any;

      const result = service.getDecryptedCredentials(up);

      expect(result.productEmail).toBeNull();
      expect(result.password).toBeUndefined();
      expect(result.apiToken).toBeUndefined();
    });
  });
});
