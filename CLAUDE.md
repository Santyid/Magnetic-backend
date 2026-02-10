# Login Magnetic - Backend

SSO (Single Sign-On) que centraliza el acceso a SocialGest, Tikket, AdvocatesPro y Quantico sin modificar sus arquitecturas existentes.

## Restricciones Criticas
1. **NO modificar** bases de datos, backends ni configuracion de productos existentes
2. Cada producto mantiene su **autonomia total**
3. Login Magnetic es **100% independiente**
4. Integracion via **JWT redirect** (NO iframes)
5. SSO usa `JWT_SECRET` compartido entre Magnetic y cada producto

## Tech Stack
| Capa | Tecnologia |
|------|-----------|
| Backend | Node.js + NestJS |
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Database | PostgreSQL (TypeORM) |
| Auth | JWT + Refresh Tokens |
| Encryption | AES-256-GCM |
| AI | OpenAI gpt-4o-mini |
| State | Zustand |
| i18n | ES / EN / PT |

## Quick Start
```bash
# 1. PostgreSQL
docker run --name magnetic-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=magnetic_db -p 5432:5432 -d postgres

# 2. Configurar
cp .env.example .env

# 3. Levantar servidor
npm run start:dev

# 4. Seeds (productos + usuarios demo)
npm run seed:demo
```
Servidor: `http://localhost:3000/api`

## Test Credentials
| Email | Password | Rol | Productos |
|-------|----------|-----|-----------|
| `admin@magnetic.com` | `Admin123!` | Admin | 0 |
| `demo@magnetic.com` | `Demo123!` | Normal | 4 |
| `user1@magnetic.com` | `User123!` | Normal | 0 |
| `user2@magnetic.com` | `User123!` | Normal | 1 |
| `user3@magnetic.com` | `User123!` | Normal | 2 |
| `user4@magnetic.com` | `User123!` | Normal | 3 |

## Project Structure
```
src/
├── main.ts
├── app.module.ts
├── health.controller.ts
├── config/configuration.ts
├── common/services/encryption.service.ts
├── modules/
│   ├── auth/        # Login, register, JWT, refresh, sessions, password recovery
│   ├── users/       # CRUD usuarios
│   ├── products/    # CRUD productos, asignacion, credenciales
│   ├── sessions/    # Gestion de sesiones activas
│   ├── ai/          # Asistente AI (OpenAI proxy)
│   ├── dashboard/   # Conexion productos, metricas, conectores
│   └── creators/    # Meta Creator Marketplace
└── database/seeds/  # setup-demo.ts, setup-custom-users.ts
```

## API Summary
| Modulo | Prefijo | Endpoints | Guards |
|--------|---------|-----------|--------|
| Auth | `/api/auth` | 11 | Publico / JWT |
| Users | `/api/users` | 6 | JWT + Admin |
| Products | `/api/products` | 9 | JWT / Admin |
| Dashboard | `/api/dashboard` | 4 | JWT |
| AI | `/api/ai` | 1 | JWT |
| Creators | `/api/creators` | 2 | JWT + Admin |
| Health | `/api/health` | 1 | Publico |

## Useful Commands
```bash
npm run start:dev        # Desarrollo con hot-reload
npm run build            # Build produccion
npm run seed:demo        # Seed: admin + demo (4 productos)
npm run seed:custom      # Seed: user1-4 (0-3 productos)
npm run test             # Tests unitarios
npm run test:cov         # Coverage
```

## Environment Variables
Ver `.env.example` para la lista completa. Variables criticas:
- `DATABASE_*` - Conexion PostgreSQL
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Firma de tokens
- `CORS_ORIGIN` - URL del frontend (HTTPS en produccion)
- `CREDENTIALS_ENCRYPTION_KEY` - 64 hex chars para AES-256-GCM
- `OPENAI_API_KEY` - API key de OpenAI
- `META_*` - Meta Creator Marketplace (opcional)

## Documentation Index

### Rules (conventions)
- [Architecture](.claude/rules/architecture.md) - Constraints, stack, module structure
- [API Conventions](.claude/rules/api-conventions.md) - Prefix, guards, DTOs, error codes
- [Security](.claude/rules/security.md) - JWT, encryption, CORS, passwords
- [Design System](.claude/rules/design-system.md) - Colors, icons, buttons, tokens
- [i18n](.claude/rules/i18n.md) - Languages, translations, error code mapping
- [Naming Conventions](.claude/rules/naming-conventions.md) - Modules, entities, DTOs

### Reference Docs
- [API Reference](docs/api-reference.md) - All endpoints with request/response details
- [Data Model](docs/data-model.md) - User, Product, UserProduct, Session entities
- [Auth & SSO Flow](docs/auth-flow.md) - Login, JWT lifecycle, SSO redirect, password recovery
- [Dashboard & Metrics](docs/dashboard-metrics.md) - Product connection, encryption, connectors
- [Frontend Integration](docs/frontend-integration.md) - FE-BE integration, TypeScript types, components
- [Deploy Railway](docs/deploy-railway.md) - Dockerfile, env vars, production URLs
- [Testing E2E](docs/testing-e2e.md) - Playwright setup, test files, selector patterns
- [AI Assistant](docs/ai-assistant.md) - OpenAI proxy, system prompt, rate limiting
- [Landing Page](docs/landing-page.md) - Dark theme, animations, CSS classes
- [Project Status](docs/project-status.md) - Current state, pending items
- [Creators Module](docs/creators-module.md) - Meta Creator Marketplace integration

### Prompts (task templates)
- [New Endpoint](.claude/prompts/new-endpoint.md) - Checklist for adding API endpoints
- [New Connector](.claude/prompts/new-connector.md) - Adding product connectors
- [New Feature](.claude/prompts/new-feature.md) - General feature implementation
- [Deployment](.claude/prompts/deployment.md) - Pre-deploy checklist & Railway deploy
- [Debug](.claude/prompts/debug.md) - Debugging guide & common issues

### Skills (slash commands)
- `/health` - Check service health status
- `/seed` - Run database seeds
- `/deploy` - Deploy to Railway
- `/test` - Run unit or E2E tests

## Production URLs
| Servicio | URL |
|----------|-----|
| Backend | `https://magnetic-backend-production.up.railway.app/api` |
| Frontend | `https://magnetic-frontend-production.up.railway.app` |
| Health | `https://magnetic-backend-production.up.railway.app/api/health` |

## Current Status
Backend 100% completo, Frontend 100% MVP, Deploy Railway operativo. Ver [project-status.md](docs/project-status.md) para detalles.
