import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface AdvocatesAuthResult {
  token: string;
  expiresAt: number;
}

@Injectable()
export class AdvocatesConnector {
  private readonly logger = new Logger(AdvocatesConnector.name);
  private tokenCache = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  async authenticate(
    email: string,
    password: string,
    subdomain: string,
  ): Promise<AdvocatesAuthResult> {
    const cacheKey = `${email}:${subdomain}`;
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached;
    }

    try {
      const response = await axios.post(
        'https://api.qa.advocatespro.com/login',
        { email, password, subdomain },
      );

      const resData = response.data?.data || response.data;
      if (!resData?.token) {
        throw new Error('Login failed: invalid response');
      }

      const token = resData.token;
      // Cache for 24 hours (or until JWT expires)
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      this.tokenCache.set(cacheKey, { token, expiresAt });

      return { token, expiresAt };
    } catch (error) {
      this.logger.error(
        `Advocates login failed for ${email}@${subdomain}: ${error.message}`,
      );
      throw new Error('ADVOCATES_AUTH_FAILED');
    }
  }

  async getMetrics(
    token: string,
    year?: number,
    typeFilter = 'all',
  ): Promise<Record<string, any>> {
    const currentYear = year || new Date().getFullYear();

    try {
      const response = await axios.get(
        'https://api.qa.advocatespro.com/get-metrics-dashboard-admin',
        {
          params: { typeFilter, year: currentYear },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Advocates metrics fetch failed: ${error.message}`);
      throw new Error('ADVOCATES_METRICS_FAILED');
    }
  }
}
