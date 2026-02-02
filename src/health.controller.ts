import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async check() {
    const services = {
      database: await this.checkDatabase(),
      openai: this.checkOpenAI(),
      encryption: this.checkEncryption(),
      jwt: this.checkJWT(),
    };

    const allHealthy = Object.values(services).every(
      (s) => s.status === 'ok',
    );

    return {
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Login Magnetic Backend',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services,
    };
  }

  private async checkDatabase(): Promise<{ status: string; message?: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  private checkOpenAI(): { status: string; message?: string } {
    const apiKey = this.configService.get('openai.apiKey');
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      return { status: 'not_configured', message: 'OPENAI_API_KEY not set' };
    }
    return { status: 'ok' };
  }

  private checkEncryption(): { status: string; message?: string } {
    const key = this.configService.get('credentialsEncryptionKey');
    if (!key || key === 'your-64-char-hex-key-here') {
      return { status: 'not_configured', message: 'CREDENTIALS_ENCRYPTION_KEY not set' };
    }
    if (key.length !== 64) {
      return { status: 'error', message: 'Key must be 64 hex characters' };
    }
    return { status: 'ok' };
  }

  private checkJWT(): { status: string; message?: string } {
    const secret = this.configService.get('jwt.secret');
    if (!secret || secret.includes('change-in-production')) {
      return { status: 'warning', message: 'Using default JWT secret' };
    }
    return { status: 'ok' };
  }
}
