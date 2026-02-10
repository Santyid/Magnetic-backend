# Deploy - Railway

## Architecture
```
┌─────────────────────────────────────────┐
│           Railway Project               │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  PostgreSQL  │  │    Backend      │  │
│  │  (Database)  │◀─│  (Dockerfile)   │  │
│  │  railway DB  │  │  Node 20        │  │
│  └─────────────┘  └─────────────────┘  │
│  ┌─────────────────────────────────┐   │
│  │         Frontend                │   │
│  │    (Vite + React)               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Production URLs
| Servicio | URL |
|----------|-----|
| Backend | `https://magnetic-backend-production.up.railway.app/api` |
| Frontend | `https://magnetic-frontend-production.up.railway.app` |
| Health Check | `https://magnetic-backend-production.up.railway.app/api/health` |

## Dockerfile (Backend)
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY start.sh ./start.sh
RUN chmod +x start.sh
EXPOSE ${PORT:-3000}
CMD ["./start.sh"]
```

## start.sh (Auto-seed)
```bash
#!/bin/sh
echo "Running seeds..."
node dist/database/seeds/setup-demo.js || echo "Seeds failed, continuing..."
echo "Starting server..."
node dist/main
```
Seeds son idempotentes: si los datos ya existen, no se duplican.

## Environment Variables - Backend (Railway)
```env
# Database (TCP Proxy de Railway PostgreSQL)
DATABASE_HOST=turntable.proxy.rlwy.net
DATABASE_PORT=46474
DATABASE_USER=postgres
DATABASE_PASSWORD=<password-de-railway>
DATABASE_NAME=railway

# JWT
JWT_SECRET=<generar-secret-seguro>
JWT_REFRESH_SECRET=<generar-otro-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS (IMPORTANTE: usar https://, NO http://)
CORS_ORIGIN=https://magnetic-frontend-production.up.railway.app

# Encryption
CREDENTIALS_ENCRYPTION_KEY=<openssl rand -hex 32>

# OpenAI
OPENAI_API_KEY=<tu-api-key>
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500

# Environment
NODE_ENV=production
```

## Environment Variables - Frontend (Railway)
```env
VITE_API_URL=https://magnetic-backend-production.up.railway.app/api
```

## Gotchas
1. **CORS con HTTPS:** Railway sirve con HTTPS. `CORS_ORIGIN` DEBE usar `https://` (no `http://`)
2. **PostgreSQL TCP Proxy:** Usar valores publicos del TCP Proxy (no `postgres.railway.internal`)
3. **package-lock.json:** Debe estar en el repo para que `npm ci` funcione en Docker
4. **Health Check:** Usar `GET /api/health` para verificar servicios

## Pre-Deploy Checklist
- [ ] `npm run build` compila sin errores
- [ ] `package-lock.json` commiteado
- [ ] Variables de entorno configuradas en Railway
- [ ] `CORS_ORIGIN` usa `https://`
- [ ] `JWT_SECRET` no es el default
- [ ] `CREDENTIALS_ENCRYPTION_KEY` tiene 64 caracteres hex
