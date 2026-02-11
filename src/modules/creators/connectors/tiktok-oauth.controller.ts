import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import axios from 'axios';

/**
 * Utility controller for TikTok OAuth2 flow.
 * Uses the TikTok v2 OAuth (tiktok.com/v2/auth/authorize) which is
 * what the TikTok Developer Portal generates.
 *
 * Flow:
 * 1. Visit GET /api/tiktok/authorize → redirects to TikTok auth page
 * 2. TikTok redirects back to GET /api/tiktok/callback?code=xxx
 * 3. Callback exchanges code for access_token and displays it
 */
@Controller('tiktok')
export class TikTokOAuthController {
  private readonly logger = new Logger(TikTokOAuthController.name);

  constructor(private configService: ConfigService) {}

  @Get('authorize')
  authorize(@Res() res: Response) {
    const appId = this.configService.get<string>('tiktok.appId');
    if (!appId) {
      return res.status(400).send(
        '<h2>Error: TIKTOK_APP_ID not configured in .env</h2>',
      );
    }

    const redirectUri = this.getRedirectUri();
    const state = 'magnetic_tiktok_setup';

    // Scopes for TTCM (Creator Marketplace) access
    const scopes = [
      'user.info.basic',
      'biz.creator.info',
      'biz.creator.insights',
      'video.list',
      'tto.campaign.link',
      'biz.brand.insights',
      'comment.list',
    ].join(',');

    // Use TikTok v2 OAuth (matches the Developer Portal configuration)
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

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('auth_code') authCode: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    // Handle error response from TikTok
    if (error) {
      return res.status(400).send(
        `<h2>TikTok authorization denied</h2>` +
          `<p>Error: ${error}</p>` +
          `<p>${errorDescription || ''}</p>`,
      );
    }

    // TikTok v2 sends 'code', Business API sends 'auth_code'
    const finalCode = code || authCode;

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

    // Try v2 token exchange first, then fallback to Business API
    const tokenData = await this.exchangeTokenV2(appId, appSecret, finalCode);
    if (tokenData) {
      return this.renderSuccess(res, tokenData);
    }

    const businessTokenData = await this.exchangeTokenBusiness(
      appId,
      appSecret,
      finalCode,
    );
    if (businessTokenData) {
      return this.renderSuccess(res, businessTokenData);
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
   * TikTok Business API token exchange (fallback).
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

  private renderSuccess(res: Response, tokenData: any) {
    const accessToken =
      tokenData.access_token || tokenData.data?.access_token || 'N/A';
    const refreshToken =
      tokenData.refresh_token || tokenData.data?.refresh_token;
    const expiresIn =
      tokenData.expires_in ||
      tokenData.access_token_expires_in ||
      tokenData.data?.access_token_expires_in;
    const scope =
      tokenData.scope || tokenData.data?.scope || 'N/A';
    const advertiserIds =
      tokenData.advertiser_ids || tokenData.data?.advertiser_ids;
    const openId = tokenData.open_id;

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
        <p>Copy the access token to your Railway env vars as <code>TIKTOK_ACCESS_TOKEN</code>:</p>

        <div class="token-box">
          <div class="label">TIKTOK_ACCESS_TOKEN</div>
          <div>${accessToken}</div>
        </div>

        ${advertiserIds ? `
        <div class="token-box">
          <div class="label">Advertiser IDs</div>
          <div>${JSON.stringify(advertiserIds)}</div>
        </div>
        ` : ''}

        ${openId ? `
        <div class="token-box">
          <div class="label">Open ID</div>
          <div>${openId}</div>
        </div>
        ` : ''}

        <div class="token-box">
          <div class="label">Scope</div>
          <div>${scope}</div>
        </div>

        <div class="token-box">
          <div class="label">Token Expires In</div>
          <div>${expiresIn ? expiresIn + ' seconds (~' + Math.round(expiresIn / 3600) + ' hours)' : 'N/A'}</div>
        </div>

        ${refreshToken ? `
        <div class="token-box">
          <div class="label">Refresh Token (save this too!)</div>
          <div>${refreshToken}</div>
        </div>
        ` : ''}

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
