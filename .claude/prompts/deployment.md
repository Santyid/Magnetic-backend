# Prompt: Deploy to Railway

## Pre-Deploy Checklist
- [ ] `npm run build` compila sin errores
- [ ] `package-lock.json` esta commiteado
- [ ] No hay archivos sensibles (.env, credentials) en git
- [ ] Tests pasan (si aplica)

## Deploy Steps

### 1. Verificar build
```bash
npm run build
```

### 2. Verificar env vars en Railway
Variables criticas:
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `JWT_SECRET` (no default), `JWT_REFRESH_SECRET`
- `CORS_ORIGIN` (DEBE ser `https://`, no `http://`)
- `CREDENTIALS_ENCRYPTION_KEY` (64 hex chars)
- `OPENAI_API_KEY`
- `NODE_ENV=production`

### 3. Push to deploy
```bash
git push origin main
```
Railway detecta el push y hace deploy automatico.

### 4. Verificar deploy
```bash
curl https://magnetic-backend-production.up.railway.app/api/health
```

Verificar:
- `status: "ok"` (no "degraded")
- Todos los services en "ok"
- Todos los endpoints registrados

## Rollback
Si algo falla, Railway permite revertir al deploy anterior desde el dashboard.

## Gotchas
1. CORS con HTTPS: `CORS_ORIGIN` DEBE usar `https://`
2. PostgreSQL: Usar TCP Proxy publico, no `postgres.railway.internal`
3. Seeds: `start.sh` ejecuta seeds automaticamente (idempotentes)
