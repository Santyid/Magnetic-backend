# Magnetic Backend (api/)

NestJS API para Login Magnetic SSO. Ver [../CLAUDE.md](../CLAUDE.md) para contexto global.

## Commands
```bash
npm run start:dev        # Desarrollo con hot-reload (http://localhost:3000/api)
npm run build            # Build produccion
npm run seed:demo        # Seed: admin + demo (4 productos)
npm run seed:custom      # Seed: user1-4 (0-3 productos)
npm run test             # Tests unitarios
npm run test:cov         # Coverage
```

## Module Structure
```
src/
├── main.ts                          # Bootstrap, CORS, ValidationPipe
├── app.module.ts                    # Root module (imports all modules)
├── health.controller.ts             # Health check (per-service + endpoint verification)
├── config/configuration.ts          # Env vars configuration
├── common/
│   └── services/encryption.service.ts  # AES-256-GCM encrypt/decrypt
├── modules/
│   ├── auth/                        # 11 endpoints
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── entities/password-reset-token.entity.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── guards/admin.guard.ts
│   │   └── dto/login.dto.ts, register.dto.ts
│   ├── users/                       # 6 endpoints
│   ├── products/                    # 9 endpoints
│   ├── sessions/                    # Session management
│   ├── ai/                          # 1 endpoint (OpenAI proxy)
│   │   └── dto/chat.dto.ts
│   ├── dashboard/                   # 4 endpoints
│   │   └── connectors/advocates.connector.ts
│   └── creators/                    # 2 endpoints (Meta API)
│       └── connectors/meta.connector.ts
└── database/seeds/
    ├── setup-demo.ts
    └── setup-custom-users.ts
```

## Environment Variables
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=magnetic_db

# JWT
JWT_SECRET=<cambiar-en-produccion>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<cambiar-en-produccion>
JWT_REFRESH_EXPIRES_IN=7d

# CORS (HTTPS en produccion!)
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Encryption (generar: openssl rand -hex 32)
CREDENTIALS_ENCRYPTION_KEY=<64-hex-chars>

# OpenAI
OPENAI_API_KEY=<api-key>
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500

# Meta Creator Marketplace (opcional)
META_APP_ID=<app-id>
META_APP_SECRET=<app-secret>
META_ACCESS_TOKEN=<access-token>
META_PAGE_ID=<page-id>
META_GRAPH_API_VERSION=v24.0
```

## Product Connectors
| Producto | Conector | Estado |
|----------|----------|--------|
| AdvocatesPro | `dashboard/connectors/advocates.connector.ts` | Implementado |
| SocialGest | — | Pendiente |
| Tikket | — | Pendiente |
| Quantico | — | Pendiente |

Para agregar un conector nuevo, ver [../.claude/prompts/new-connector.md](../.claude/prompts/new-connector.md).

## Database
```bash
# PostgreSQL local
docker run --name magnetic-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=magnetic_db -p 5432:5432 -d postgres

# Seeds (idempotentes)
npm run seed:demo     # admin@magnetic.com + demo@magnetic.com
npm run seed:custom   # user1-4@magnetic.com
```

## Deploy
Dockerfile multi-stage con auto-seed via `start.sh`. Ver [../docs/deploy-railway.md](../docs/deploy-railway.md).

## Key Patterns
- Guards: `@UseGuards(JwtAuthGuard)` o `@UseGuards(JwtAuthGuard, AdminGuard)`
- Error codes: `throw new BadRequestException('UPPER_SNAKE_CODE')` (i18n-friendly)
- Encryption: `EncryptionService.encrypt()` / `.decrypt()` para credenciales
- Health check: Actualizar `health.controller.ts` al agregar endpoints

## Shared Resources (workspace root .claude/)

### Rules relevantes para backend
| Rule | Tema |
|------|------|
| [architecture](../.claude/rules/architecture.md) | Constraints, modules, dependencies |
| [api-conventions](../.claude/rules/api-conventions.md) | Prefix, guards, DTOs, error codes |
| [security](../.claude/rules/security.md) | JWT, encryption, CORS, rate limiting |
| [naming-conventions](../.claude/rules/naming-conventions.md) | Entities, DTOs, endpoints |
| [error-handling](../.claude/rules/error-handling.md) | Exceptions, error codes |
| [performance](../.claude/rules/performance.md) | Queries, caching, N+1 prevention |
| [testing](../.claude/rules/testing.md) | Jest patterns, mocking |
| [env-variables](../.claude/rules/env-variables.md) | Como agregar/documentar env vars |
| [git-workflow](../.claude/rules/git-workflow.md) | Branches, commits |

### Prompts utiles para backend
| Tarea | Prompt |
|-------|--------|
| Nuevo endpoint | [new-endpoint](../.claude/prompts/new-endpoint.md) |
| Nuevo modulo | [new-module](../.claude/prompts/new-module.md) |
| Nuevo conector | [new-connector](../.claude/prompts/new-connector.md) |
| Cambio de BD | [migration](../.claude/prompts/migration.md) |
| Escribir tests | [write-tests](../.claude/prompts/write-tests.md) |
| Code review | [code-review](../.claude/prompts/code-review.md) |
| Debug | [debug](../.claude/prompts/debug.md) |

### Skills: `/health` `/seed` `/deploy` `/test` `/lint` `/db` `/status`
