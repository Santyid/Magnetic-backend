import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserProduct } from '../products/entities/user-product.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: any;
  let userProductRepo: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@magnetic.com',
    password: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    isAdmin: false,
    isActive: true,
    userProducts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    userRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'new-user-id' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn(),
    };

    userProductRepo = {
      find: jest.fn(),
    };

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(UserProduct), useValue: userProductRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      userRepo.findOne.mockResolvedValue(null); // no existing user

      await service.create({
        email: 'new@magnetic.com',
        password: 'Test123!',
        firstName: 'New',
        lastName: 'User',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Test123!', 10);
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@magnetic.com', password: 'hashed-password' }),
      );
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw EMAIL_ALREADY_EXISTS for duplicate email', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create({
          email: 'test@magnetic.com',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users with relations', async () => {
      userRepo.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(userRepo.find).toHaveBeenCalledWith({
        relations: ['userProducts', 'userProducts.product'],
      });
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(result.id).toBe('user-1');
    });

    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@magnetic.com');

      expect(result!.email).toBe('test@magnetic.com');
    });

    it('should return null when email not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('no@magnetic.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });

      await service.update('user-1', { firstName: 'Updated' });

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Updated' }),
      );
    });

    it('should hash password when updating password', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser });

      await service.update('user-1', { password: 'NewPass1!' });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass1!', 10);
    });

    it('should throw EMAIL_ALREADY_EXISTS when changing to existing email', async () => {
      userRepo.findOne
        .mockResolvedValueOnce({ ...mockUser }) // findOne for the user
        .mockResolvedValueOnce({ id: 'other-user', email: 'taken@magnetic.com' }); // findByEmail check

      await expect(
        service.update('user-1', { email: 'taken@magnetic.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove user', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.remove('user-1');

      expect(userRepo.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('should return true for matching passwords', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword('plain', 'hashed');

      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword('wrong', 'hashed');

      expect(result).toBe(false);
    });
  });

  describe('getUserProducts', () => {
    it('should return user products', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      userProductRepo.find.mockResolvedValue([{ id: 'up-1', productId: 'prod-1' }]);

      const result = await service.getUserProducts('user-1');

      expect(result).toHaveLength(1);
      expect(userProductRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['product'],
      });
    });

    it('should throw USER_NOT_FOUND when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getUserProducts('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
