import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionsService } from './sessions.service';
import { Session } from './entities/session.entity';

describe('SessionsService', () => {
  let service: SessionsService;
  let repo: any;

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    token: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date('2030-01-01'),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn((dto) => ({ ...dto, id: 'new-session' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(Session), useValue: repo },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  describe('create', () => {
    it('should create and save a session', async () => {
      const expiresAt = new Date('2030-01-01');
      const result = await service.create('user-1', 'token', 'refresh', expiresAt, '127.0.0.1', 'agent');

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        token: 'token',
        refreshToken: 'refresh',
        expiresAt,
        ipAddress: '127.0.0.1',
        userAgent: 'agent',
      });
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('findByToken', () => {
    it('should find session by access token', async () => {
      repo.findOne.mockResolvedValue(mockSession);

      const result = await service.findByToken('access-token');

      expect(result).toEqual(mockSession);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { token: 'access-token' },
        relations: ['user'],
      });
    });

    it('should return null when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findByToken('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByRefreshToken', () => {
    it('should find session by refresh token', async () => {
      repo.findOne.mockResolvedValue(mockSession);

      const result = await service.findByRefreshToken('refresh-token');

      expect(result).toEqual(mockSession);
    });
  });

  describe('findByUserId', () => {
    it('should return all sessions for a user ordered by createdAt DESC', async () => {
      repo.find.mockResolvedValue([mockSession]);

      const result = await service.findByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('deleteByToken', () => {
    it('should delete session by access token', async () => {
      await service.deleteByToken('access-token');

      expect(repo.delete).toHaveBeenCalledWith({ token: 'access-token' });
    });
  });

  describe('deleteByRefreshToken', () => {
    it('should delete session by refresh token', async () => {
      await service.deleteByRefreshToken('refresh-token');

      expect(repo.delete).toHaveBeenCalledWith({ refreshToken: 'refresh-token' });
    });
  });

  describe('deleteExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      await service.deleteExpiredSessions();

      expect(repo.delete).toHaveBeenCalled();
    });
  });

  describe('deleteAllUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      await service.deleteAllUserSessions('user-1');

      expect(repo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });
});
