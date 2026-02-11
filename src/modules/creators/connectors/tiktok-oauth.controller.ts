import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import axios from 'axios';

/**
 * Utility controller for TikTok OAuth2 flow.
 * Used to obtain the initial access_token during setup.
 * NOT protected by JWT — this is a one-time setup endpoint.
 *
 * Flow:
 * 1. Visit GET /api/tiktok/authorize → redirects to TikTok auth page
 * 2. TikTok redirects back to GET /api/tiktok/callback?auth_code=xxx
 * 3. Callback exchanges auth_code for access_token and displays it
 */
@Controller('tiktok')
export class TikTokOAuthController {
  private readonly logger = new Logger(TikTokOAuthController.name);
  private readonly baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';

  constructor(private configService: ConfigService) {}

  /**
   * Step 1: Redirect user to TikTok authorization page.
   * Visit http://localhost:3000/api/tiktok/authorize to start.
   */
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

    const authUrl =
      `https://business-api.tiktok.com/portal/auth` +
      `?app_id=${appId}` +
      `&state=${state}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    this.logger.log(`Redirecting to TikTok auth: ${authUrl}`);
    return res.redirect(authUrl);
  }

  /**
   * Step 2: TikTok redirects here with auth_code.
   * Exchanges it for access_token automatically.
   */
  @Get('callback')
  async callback(
    @Query('auth_code') authCode: string,
    @Query('state') state: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    // TikTok may send the code as 'auth_code' or 'code'
    const finalCode = authCode || code;

    if (!finalCode) {
      return res.status(400).send(
        '<h2>Error: No auth_code received from TikTok</h2>' +
          '<p>Query params received: ' +
          JSON.stringify({ auth_code: authCode, state, code }) +
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

    try {
      this.logger.log('Exchanging auth_code for access_token...');

      const response = await axios.post(
        `${this.baseUrl}/oauth2/access_token/`,
        {
          app_id: appId,
          secret: appSecret,
          auth_code: finalCode,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const data = response.data;

      if (data.code !== 0) {
        this.logger.error(`Token exchange failed: ${JSON.stringify(data)}`);
        return res.status(400).send(
          '<h2>Token exchange failed</h2>' +
            `<pre>${JSON.stringify(data, null, 2)}</pre>`,
        );
      }

      const tokenData = data.data;
      this.logger.log('Access token obtained successfully!');

      // Display the token info in a simple HTML page
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
          </style>
        </head>
        <body>
          <h1 class="success">TikTok OAuth Successful!</h1>
          <p>Copy these values to your <code>api/.env</code> file:</p>

          <div class="token-box">
            <div class="label">TIKTOK_ACCESS_TOKEN</div>
            <div>${tokenData.access_token || 'N/A'}</div>
          </div>

          <div class="token-box">
            <div class="label">Advertiser IDs</div>
            <div>${JSON.stringify(tokenData.advertiser_ids || [])}</div>
          </div>

          <div class="token-box">
            <div class="label">Scope</div>
            <div>${tokenData.scope || 'N/A'}</div>
          </div>

          <div class="token-box">
            <div class="label">Token Expires In</div>
            <div>${tokenData.access_token_expires_in ? tokenData.access_token_expires_in + ' seconds' : 'N/A'}</div>
          </div>

          ${tokenData.refresh_token ? `
          <div class="token-box">
            <div class="label">Refresh Token (save this too)</div>
            <div>${tokenData.refresh_token}</div>
          </div>
          ` : ''}

          <p class="warn">
            This token expires. Save the refresh token if available to renew it later.
            Close this page once you've copied the values.
          </p>
        </body>
        </html>
      `);
    } catch (error) {
      this.logger.error(`OAuth token exchange error: ${error.message}`);
      return res.status(500).send(
        '<h2>Error exchanging auth_code</h2>' +
          `<pre>${error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message}</pre>`,
      );
    }
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
