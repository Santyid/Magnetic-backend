import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import axios from 'axios';

/**
 * Utility controller for TikTok OAuth2 flow.
 *
 * TikTok has TWO separate API systems with incompatible tokens:
 * - v2 API (developers.tiktok.com) → token for open.tiktokapis.com
 * - Business API (business-api.tiktok.com) → token for business-api.tiktok.com
 *
 * TTCM (Creator Marketplace) endpoints ONLY work with Business API tokens.
 *
 * Endpoints:
 * - GET /api/tiktok/authorize          → Business API OAuth (for TTCM access)
 * - GET /api/tiktok/authorize-v2       → v2 OAuth (for basic user/video access)
 * - GET /api/tiktok/callback           → Handles callback from both flows
 */
@Controller('tiktok')
export class TikTokOAuthController {
  private readonly logger = new Logger(TikTokOAuthController.name);

  constructor(private configService: ConfigService) {}

  /**
   * Business API OAuth flow (required for TTCM endpoints).
   * Redirects to business-api.tiktok.com/portal/auth
   */
  @Get('authorize')
  authorize(@Res() res: Response) {
    const appId = this.configService.get<string>('tiktok.appId');
    if (!appId) {
      return res
        .status(400)
        .send('<h2>Error: TIKTOK_APP_ID not configured in .env</h2>');
    }

    const redirectUri = this.getRedirectUri();
    const state = 'magnetic_tiktok_business';

    const authUrl =
      `https://business-api.tiktok.com/portal/auth` +
      `?app_id=${appId}` +
      `&state=${state}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    this.logger.log(`Redirecting to TikTok Business API auth: ${authUrl}`);
    return res.redirect(authUrl);
  }

  /**
   * v2 OAuth flow (for basic user info and video access).
   * Redirects to tiktok.com/v2/auth/authorize
   */
  @Get('authorize-v2')
  authorizeV2(@Res() res: Response) {
    const appId = this.configService.get<string>('tiktok.appId');
    if (!appId) {
      return res
        .status(400)
        .send('<h2>Error: TIKTOK_APP_ID not configured in .env</h2>');
    }

    const redirectUri = this.getRedirectUri();
    const state = 'magnetic_tiktok_v2';

    const scopes = [
      'user.info.basic',
      'biz.creator.info',
      'biz.creator.insights',
      'video.list',
      'tto.campaign.link',
      'biz.brand.insights',
      'comment.list',
    ].join(',');

    const authUrl =
      `https://www.tiktok.com/v2/auth/authorize` +
      `?client_key=${appId}` +
      `&scope=${scopes}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    this.logger.log(`Redirecting to TikTok v2 auth: ${authUrl}`);
    return res.redirect(authUrl);
  }

  /**
   * Callback handler for both Business API and v2 OAuth flows.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('auth_code') authCode: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.status(400).send(
        `<h2>TikTok authorization denied</h2>` +
          `<p>Error: ${error}</p>` +
          `<p>${errorDescription || ''}</p>`,
      );
    }

    // Business API sends 'auth_code', v2 sends 'code'
    const finalCode = authCode || code;

    if (!finalCode) {
      return res.status(400).send(
        '<h2>Error: No authorization code received from TikTok</h2>' +
          '<p>Query params received: ' +
          JSON.stringify({ code, auth_code: authCode, state, error }) +
          '</p>',
      );
    }

    const appId = this.configService.get<string>('tiktok.appId');
    const appSecret = this.configService.get<string>('tiktok.appSecret');

    if (!appId || !appSecret) {
      return res.status(400).send(
        '<h2>Error: TIKTOK_APP_ID or TIKTOK_APP_SECRET not configured</h2>',
      );
    }

    const isBusinessFlow = state === 'magnetic_tiktok_business' || !!authCode;

    // Try Business API token exchange first if it's a Business flow
    if (isBusinessFlow) {
      const businessToken = await this.exchangeTokenBusiness(
        appId,
        appSecret,
        finalCode,
      );
      if (businessToken) {
        return this.renderSuccess(res, businessToken, 'business_api');
      }
    }

    // Try v2 token exchange
    const v2Token = await this.exchangeTokenV2(appId, appSecret, finalCode);
    if (v2Token) {
      return this.renderSuccess(res, v2Token, 'v2_oauth');
    }

    // Fallback: try the other method
    if (!isBusinessFlow) {
      const businessToken = await this.exchangeTokenBusiness(
        appId,
        appSecret,
        finalCode,
      );
      if (businessToken) {
        return this.renderSuccess(res, businessToken, 'business_api');
      }
    }

    return res.status(500).send(
      '<h2>Error: Both token exchange methods failed</h2>' +
        '<p>Check server logs for details.</p>',
    );
  }

  /**
   * TikTok v2 OAuth token exchange.
   * POST https://open.tiktokapis.com/v2/oauth/token/
   */
  private async exchangeTokenV2(
    appId: string,
    appSecret: string,
    code: string,
  ): Promise<any | null> {
    try {
      this.logger.log('Trying v2 token exchange...');

      const params = new URLSearchParams({
        client_key: appId,
        client_secret: appSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
      });

      const response = await axios.post(
        'https://open.tiktokapis.com/v2/oauth/token/',
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const data = response.data;

      if (data.access_token) {
        this.logger.log('v2 token exchange successful!');
        return data;
      }

      if (data.data?.access_token) {
        this.logger.log('v2 token exchange successful (nested)!');
        return data.data;
      }

      this.logger.warn(`v2 token exchange response: ${JSON.stringify(data)}`);
      return null;
    } catch (err) {
      this.logger.warn(
        `v2 token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`,
      );
      return null;
    }
  }

  /**
   * TikTok Business API token exchange.
   * POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/
   */
  private async exchangeTokenBusiness(
    appId: string,
    appSecret: string,
    authCode: string,
  ): Promise<any | null> {
    try {
      this.logger.log('Trying Business API token exchange...');

      const response = await axios.post(
        'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
        {
          app_id: appId,
          secret: appSecret,
          auth_code: authCode,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const data = response.data;

      if (data.code === 0 && data.data?.access_token) {
        this.logger.log('Business API token exchange successful!');
        return data.data;
      }

      this.logger.warn(
        `Business API token exchange response: ${JSON.stringify(data)}`,
      );
      return null;
    } catch (err) {
      this.logger.warn(
        `Business API token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`,
      );
      return null;
    }
  }

  private renderSuccess(res: Response, tokenData: any, tokenType: string) {
    const accessToken =
      tokenData.access_token || tokenData.data?.access_token || 'N/A';
    const refreshToken =
      tokenData.refresh_token || tokenData.data?.refresh_token;
    const expiresIn =
      tokenData.expires_in ||
      tokenData.access_token_expires_in ||
      tokenData.data?.access_token_expires_in;
    const scope = tokenData.scope || tokenData.data?.scope || 'N/A';
    const advertiserIds =
      tokenData.advertiser_ids || tokenData.data?.advertiser_ids;
    const openId = tokenData.open_id;

    const isBusinessToken = tokenType === 'business_api';
    const tokenWarning = !isBusinessToken
      ? `<div class="warn" style="background:#fef3c7;border:1px solid #f59e0b;padding:12px;border-radius:8px;margin:16px 0;">
          <strong>Warning:</strong> This is a v2 OAuth token. It will NOT work with TikTok Creator Marketplace (TTCM) endpoints.
          To get a Business API token, register your app at
          <a href="https://business-api.tiktok.com/portal/developer/register" target="_blank">business-api.tiktok.com</a>
          and use the <code>/api/tiktok/authorize</code> endpoint (Business API flow).
        </div>`
      : `<div style="background:#d1fae5;border:1px solid #10b981;padding:12px;border-radius:8px;margin:16px 0;">
          <strong>Business API token obtained.</strong> This token works with TTCM endpoints.
        </div>`;

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>TikTok OAuth - Success</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; }
          .success { color: #16a34a; }
          .token-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; word-break: break-all; }
          .label { font-weight: 600; color: #475569; margin-bottom: 4px; }
          .warn { color: #d97706; font-size: 14px; margin-top: 24px; }
          code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
          pre { background: #f1f5f9; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1 class="success">TikTok OAuth Successful!</h1>
        <p>Token type: <strong>${tokenType}</strong></p>
        ${tokenWarning}
        <p>Copy the access token to your Railway env vars as <code>TIKTOK_ACCESS_TOKEN</code>:</p>

        <div class="token-box">
          <div class="label">TIKTOK_ACCESS_TOKEN</div>
          <div>${accessToken}</div>
        </div>

        ${
          advertiserIds
            ? `
        <div class="token-box">
          <div class="label">Advertiser IDs</div>
          <div>${JSON.stringify(advertiserIds)}</div>
        </div>
        `
            : ''
        }

        ${
          openId
            ? `
        <div class="token-box">
          <div class="label">Open ID</div>
          <div>${openId}</div>
        </div>
        `
            : ''
        }

        <div class="token-box">
          <div class="label">Scope</div>
          <div>${scope}</div>
        </div>

        <div class="token-box">
          <div class="label">Token Expires In</div>
          <div>${expiresIn ? expiresIn + ' seconds (~' + Math.round(expiresIn / 3600) + ' hours)' : 'N/A'}</div>
        </div>

        ${
          refreshToken
            ? `
        <div class="token-box">
          <div class="label">Refresh Token (save this too!)</div>
          <div>${refreshToken}</div>
        </div>
        `
            : ''
        }

        <h3>Full response:</h3>
        <pre>${JSON.stringify(tokenData, null, 2)}</pre>

        <p class="warn">
          Save these values and close this page.
          The token expires — use the refresh token to renew it.
        </p>
      </body>
      </html>
    `);
  }

  private getRedirectUri(): string {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      return 'https://magnetic-backend-production.up.railway.app/api/tiktok/callback';
    }
    const port = this.configService.get<number>('port') || 3000;
    return `http://localhost:${port}/api/tiktok/callback`;
  }
}
