# Naming Conventions

## Modulos NestJS
| Tipo | Patron | Ejemplo |
|------|--------|---------|
| Module | `nombre.module.ts` | `auth.module.ts` |
| Controller | `nombre.controller.ts` | `auth.controller.ts` |
| Service | `nombre.service.ts` | `auth.service.ts` |
| Entity | `nombre.entity.ts` | `user.entity.ts` |
| DTO | `verbo-sustantivo.dto.ts` | `login.dto.ts`, `chat.dto.ts` |
| Guard | `nombre.guard.ts` | `jwt-auth.guard.ts` |
| Strategy | `nombre.strategy.ts` | `jwt.strategy.ts` |
| Connector | `nombre.connector.ts` | `advocates.connector.ts` |

## Entidades TypeORM
- Nombre de clase: PascalCase singular (`User`, `Product`, `UserProduct`)
- Nombre de tabla: snake_case plural via decorator `@Entity('users')`
- Columnas: camelCase en TypeScript, snake_case en DB via `name:` decorator

## Endpoints
- Rutas: kebab-case (`/auth/forgot-password`, `/auth/reset-password`)
- Parametros: camelCase (`:userId`, `:userProductId`)

## Variables de Entorno
- UPPER_SNAKE_CASE (`JWT_SECRET`, `DATABASE_HOST`, `CORS_ORIGIN`)

## Frontend
- Componentes: PascalCase (`ConnectProductModal.tsx`, `TopBanner.tsx`)
- Hooks: camelCase con prefijo `use` (`useAuth.ts`)
- Store: camelCase (`authStore.ts`)
- Servicios: camelCase (`api.ts`)
- Tipos: PascalCase (`User`, `Product`, `AuthResponse`)

## Codigos de Error
- UPPER_SNAKE_CASE (`INVALID_PRODUCT_CREDENTIALS`, `AI_RATE_LIMIT_EXCEEDED`)
