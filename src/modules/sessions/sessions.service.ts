import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
  ) {}

  async create(
    userId: string,
    token: string,
    refreshToken: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Session> {
    const session = this.sessionsRepository.create({
      userId,
      token,
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return this.sessionsRepository.save(session);
  }

  async findByToken(token: string): Promise<Session | null> {
    return this.sessionsRepository.findOne({
      where: { token },
      relations: ['user'],
    });
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return this.sessionsRepository.findOne({
      where: { refreshToken },
      relations: ['user'],
    });
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return this.sessionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteByToken(token: string): Promise<void> {
    await this.sessionsRepository.delete({ token });
  }

  async deleteByRefreshToken(refreshToken: string): Promise<void> {
    await this.sessionsRepository.delete({ refreshToken });
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.sessionsRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.sessionsRepository.delete({ userId });
  }
}
