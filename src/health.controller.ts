import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HttpAdapterHost } from '@nestjs/core';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  @Get()
  async check() {
    const services = {
      database: await this.checkDatabase(),
      openai: this.checkOpenAI(),
      meta: this.checkMeta(),
      tiktok: this.checkTikTok(),
      encryption: this.checkEncryption(),
      jwt: this.checkJWT(),
    };

    const endpoints = this.checkEndpoints();

    const allServicesOk = Object.values(services).every(
      (s) => s.status === 'ok',
    );
    const allEndpointsOk = Object.values(endpoints).every(
      (e) => e.status === 'ok',
    );

    return {
      status: allServicesOk && allEndpointsOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Login Magnetic Backend',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services,
      endpoints,
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

  private checkMeta(): { status: string; message?: string } {
    const accessToken = this.configService.get('meta.accessToken');
    if (!accessToken) {
      return { status: 'not_configured', message: 'META_ACCESS_TOKEN not set' };
    }
    const pageId = this.configService.get('meta.pageId');
    if (!pageId) {
      return { status: 'warning', message: 'META_PAGE_ID not configured' };
    }
    return { status: 'ok' };
  }

  private checkTikTok(): { status: string; message?: string } {
    const accessToken = this.configService.get('tiktok.accessToken');
    if (!accessToken) {
      return { status: 'not_configured', message: 'TIKTOK_ACCESS_TOKEN not set' };
    }
    const tcmAccountId = this.configService.get('tiktok.tcmAccountId');
    if (!tcmAccountId) {
      return { status: 'warning', message: 'TIKTOK_TCM_ACCOUNT_ID not configured' };
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

  private checkEndpoints(): Record<string, { status: string; routes: string[]; missing?: string[] }> {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const server = httpAdapter.getInstance();
    const router = server._router;

    // Extraer todas las rutas registradas
    const registeredRoutes: string[] = [];
    if (router && router.stack) {
      for (const layer of router.stack) {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
          registeredRoutes.push(`${methods.join(',')} ${layer.route.path}`);
        }
      }
    }

    // Definir rutas esperadas por módulo
    const expectedEndpoints: Record<string, string[]> = {
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/register',
        'POST /api/auth/refresh',
        'POST /api/auth/logout',
        'GET /api/auth/me',
        'POST /api/auth/change-password',
        'POST /api/auth/forgot-password',
        'POST /api/auth/reset-password',
        'GET /api/auth/sessions',
        'POST /api/auth/logout-all',
        'DELETE /api/auth/sessions/:sessionId',
      ],
      users: [
        'GET /api/users',
        'GET /api/users/:id',
        'POST /api/users',
        'PATCH /api/users/:id',
        'DELETE /api/users/:id',
        'GET /api/users/:id/products',
      ],
      products: [
        'GET /api/products',
        'GET /api/products/all',
        'GET /api/products/:slug/access',
        'POST /api/products',
        'POST /api/products/assign/:userId',
        'PATCH /api/products/assign/:userProductId',
        'DELETE /api/products/:productId/user/:userId',
        'POST /api/products/credentials/:userProductId',
        'DELETE /api/products/credentials/:userProductId',
      ],
      dashboard: [
        'POST /api/dashboard/connect/:userProductId',
        'DELETE /api/dashboard/connect/:userProductId',
        'GET /api/dashboard/metrics',
        'POST /api/dashboard/sync/:userProductId',
      ],
      ai: [
        'POST /api/ai/chat',
      ],
      'creators-meta': [
        'GET /api/creators-meta/search',
        'GET /api/creators-meta/:creatorId',
      ],
      'creators-tiktok': [
        'POST /api/creators-tiktok/sync',
        'GET /api/creators-tiktok/sync/stats',
        'GET /api/creators-tiktok/search',
        'GET /api/creators-tiktok/:creatorId',
      ],
      proposals: [
        'POST /api/proposals',
        'GET /api/proposals',
        'GET /api/proposals/:id',
        'GET /api/proposals/:id/status',
        'DELETE /api/proposals/:id',
        'POST /api/proposals/:id/ai-analysis',
        'GET /api/proposals/image-proxy',
      ],
      'demo-proposals': [
        'POST /api/demo/proposals',
        'GET /api/demo/proposals/:id',
        'GET /api/demo/proposals/:id/status',
      ],
      health: [
        'GET /api/health',
      ],
    };

    const result: Record<string, { status: string; routes: string[]; missing?: string[] }> = {};

    for (const [module, expected] of Object.entries(expectedEndpoints)) {
      const found: string[] = [];
      const missing: string[] = [];

      for (const route of expected) {
        const [method, path] = route.split(' ');
        // Normalizar path para comparar (reemplazar :param con regex pattern)
        const pathRegex = path.replace(/:[^/]+/g, '[^/]+');
        const isRegistered = registeredRoutes.some((r) => {
          const [rMethods, rPath] = r.split(' ');
          return rMethods.includes(method) && new RegExp(`^${pathRegex}$`).test(rPath);
        });

        if (isRegistered) {
          found.push(route);
        } else {
          missing.push(route);
        }
      }

      result[module] = {
        status: missing.length === 0 ? 'ok' : 'error',
        routes: found,
        ...(missing.length > 0 && { missing }),
      };
    }

    return result;
  }
}
