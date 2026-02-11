export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'magnetic_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  products: {
    socialgest: {
      baseUrl: process.env.SOCIALGEST_URL || 'https://socialgest.com',
    },
    tikket: {
      baseUrl: process.env.TIKKET_URL || 'https://tikket.com',
    },
    advocates: {
      baseUrl: process.env.ADVOCATES_URL || 'https://advocates.com',
    },
    quantico: {
      baseUrl: process.env.QUANTICO_URL || 'https://quantico.com',
    },
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  credentialsEncryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 500,
  },
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    accessToken: process.env.META_ACCESS_TOKEN,
    igBusinessAccountId: process.env.META_IG_BUSINESS_ACCOUNT_ID,
    pageId: process.env.META_PAGE_ID,
    graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v24.0',
  },
  tiktok: {
    appId: process.env.TIKTOK_APP_ID,
    appSecret: process.env.TIKTOK_APP_SECRET,
    accessToken: process.env.TIKTOK_ACCESS_TOKEN,
    advertiserId: process.env.TIKTOK_ADVERTISER_ID,
  },
});
