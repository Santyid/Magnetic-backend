import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let sessionsService: jest.Mocked<Partial<SessionsService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;
  let resetTokenRepo: any;

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

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    token: 'access-token',
    refreshToken: 'refresh-token',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    expiresAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findOne: jest.fn(),
      validatePassword: jest.fn(),
      update: jest.fn(),
    };

    sessionsService = {
      create: jest.fn(),
      findByRefreshToken: jest.fn(),
      findByUserId: jest.fn(),
      deleteByRefreshToken: jest.fn(),
      deleteAllUserSessions: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          'jwt.secret': 'test-secret',
          'jwt.expiresIn': '15m',
          'jwt.refreshSecret': 'test-refresh-secret',
          'jwt.refreshExpiresIn': '7d',
          frontendUrl: 'http://localhost:5173',
        };
        return config[key];
      }),
    };

    resetTokenRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: SessionsService, useValue: sessionsService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(PasswordResetToken), useValue: resetTokenRepo },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a user and return without password', async () => {
      usersService.create!.mockResolvedValue(mockUser as any);

      const result = await service.register({
        email: 'test@magnetic.com',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('test@magnetic.com');
      expect(usersService.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return tokens and user on valid credentials', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);
      usersService.validatePassword!.mockResolvedValue(true);
      jwtService.sign!.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      sessionsService.create!.mockResolvedValue(mockSession as any);

      const result = await service.login(
        { email: 'test@magnetic.com', password: 'Test123!' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).not.toHaveProperty('password');
      expect(sessionsService.create).toHaveBeenCalled();
    });

    it('should throw INVALID_CREDENTIALS when user not found', async () => {
      usersService.findByEmail!.mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@magnetic.com', password: 'Test123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw INACTIVE_USER when user is inactive', async () => {
      usersService.findByEmail!.mockResolvedValue({ ...mockUser, isActive: false } as any);

      await expect(
        service.login({ email: 'test@magnetic.com', password: 'Test123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw INVALID_CREDENTIALS on wrong password', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);
      usersService.validatePassword!.mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@magnetic.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should rotate tokens on valid refresh token', async () => {
      jwtService.verify!.mockReturnValue({ sub: 'user-1', email: 'test@magnetic.com', isAdmin: false });
      sessionsService.findByRefreshToken!.mockResolvedValue(mockSession as any);
      usersService.findOne!.mockResolvedValue(mockUser as any);
      jwtService.sign!.mockReturnValueOnce('new-access').mockReturnValueOnce('new-refresh');
      sessionsService.deleteByRefreshToken!.mockResolvedValue(undefined);
      sessionsService.create!.mockResolvedValue(mockSession as any);

      const result = await service.refresh('refresh-token');

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
      expect(sessionsService.deleteByRefreshToken).toHaveBeenCalledWith('refresh-token');
    });

    it('should throw INVALID_TOKEN on invalid refresh token', async () => {
      jwtService.verify!.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when session not found', async () => {
      jwtService.verify!.mockReturnValue({ sub: 'user-1' });
      sessionsService.findByRefreshToken!.mockResolvedValue(null);

      await expect(service.refresh('orphan-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete session and return SESSION_CLOSED', async () => {
      sessionsService.deleteByRefreshToken!.mockResolvedValue(undefined);

      const result = await service.logout('refresh-token');

      expect(result.message).toBe('SESSION_CLOSED');
      expect(sessionsService.deleteByRefreshToken).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('me', () => {
    it('should return user without password', async () => {
      usersService.findOne!.mockResolvedValue(mockUser as any);

      const result = await service.me('user-1');

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('test@magnetic.com');
    });
  });

  describe('changePassword', () => {
    it('should update password on valid current password', async () => {
      usersService.findOne!.mockResolvedValue(mockUser as any);
      usersService.validatePassword!.mockResolvedValue(true);
      usersService.update!.mockResolvedValue(mockUser as any);

      const result = await service.changePassword('user-1', 'OldPass1!', 'NewPass1!');

      expect(result.message).toBe('PASSWORD_UPDATED');
      expect(usersService.update).toHaveBeenCalledWith('user-1', { password: 'NewPass1!' });
    });

    it('should throw when current password is invalid', async () => {
      usersService.findOne!.mockResolvedValue(mockUser as any);
      usersService.validatePassword!.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrong', 'NewPass1!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserSessions', () => {
    it('should return user sessions', async () => {
      sessionsService.findByUserId!.mockResolvedValue([mockSession] as any);

      const result = await service.getUserSessions('user-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('logoutAll', () => {
    it('should delete all user sessions', async () => {
      sessionsService.deleteAllUserSessions!.mockResolvedValue(undefined);

      const result = await service.logoutAll('user-1', 'refresh-token');

      expect(result.message).toBe('ALL_SESSIONS_CLOSED');
      expect(sessionsService.deleteAllUserSessions).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deleteSession', () => {
    it('should delete a specific session', async () => {
      sessionsService.findByUserId!.mockResolvedValue([mockSession] as any);
      sessionsService.deleteByRefreshToken!.mockResolvedValue(undefined);

      const result = await service.deleteSession('session-1', 'user-1');

      expect(result.message).toBe('SESSION_CLOSED');
    });

    it('should throw when session not found for user', async () => {
      sessionsService.findByUserId!.mockResolvedValue([]);

      await expect(
        service.deleteSession('nonexistent', 'user-1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should return RESET_EMAIL_SENT when user exists', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);
      resetTokenRepo.update.mockResolvedValue(undefined);
      resetTokenRepo.save.mockResolvedValue({});

      const result = await service.forgotPassword('test@magnetic.com');

      expect(result.message).toBe('RESET_EMAIL_SENT');
      expect(resetTokenRepo.save).toHaveBeenCalled();
    });

    it('should return RESET_EMAIL_SENT even when user does not exist (security)', async () => {
      usersService.findByEmail!.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@magnetic.com');

      expect(result.message).toBe('RESET_EMAIL_SENT');
      expect(resetTokenRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const mockResetToken = {
        token: 'valid-token',
        userId: 'user-1',
        used: false,
        expiresAt: futureDate,
        user: mockUser,
      };
      resetTokenRepo.findOne.mockResolvedValue(mockResetToken);
      usersService.update!.mockResolvedValue(mockUser as any);
      resetTokenRepo.save.mockResolvedValue(mockResetToken);
      sessionsService.deleteAllUserSessions!.mockResolvedValue(undefined);

      const result = await service.resetPassword('valid-token', 'NewPass1!');

      expect(result.message).toBe('PASSWORD_UPDATED');
      expect(mockResetToken.used).toBe(true);
      expect(sessionsService.deleteAllUserSessions).toHaveBeenCalledWith('user-1');
    });

    it('should throw RESET_TOKEN_INVALID for unknown token', async () => {
      resetTokenRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw RESET_TOKEN_EXPIRED for expired token', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);
      resetTokenRepo.findOne.mockResolvedValue({
        token: 'expired-token',
        userId: 'user-1',
        used: false,
        expiresAt: pastDate,
      });

      await expect(
        service.resetPassword('expired-token', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
