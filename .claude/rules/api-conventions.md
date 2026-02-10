# API Conventions

## Global Configuration
- **Prefix:** Todos los endpoints usan `/api` como prefijo global (configurado en `main.ts`)
- **Validation:** `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **CORS:** Configurado via `CORS_ORIGIN` env var

## Guards
| Guard | Archivo | Uso |
|-------|---------|-----|
| `JwtAuthGuard` | `src/modules/auth/guards/jwt-auth.guard.ts` | Requiere JWT valido |
| `AdminGuard` | `src/modules/auth/guards/admin.guard.ts` | Requiere `isAdmin: true` |

Patron de uso:
```typescript
@UseGuards(JwtAuthGuard)              // Solo autenticado
@UseGuards(JwtAuthGuard, AdminGuard)  // Solo admin
// Sin guards                          // Publico
```

## DTOs
- Usar `class-validator` decorators: `@IsString()`, `@IsEmail()`, `@IsOptional()`, `@MinLength()`
- Nombre: `verbo-sustantivo.dto.ts` (ej: `login.dto.ts`, `register.dto.ts`, `chat.dto.ts`)
- Ubicacion: `src/modules/<modulo>/dto/`

## Error Responses
- Retornar **codigos de error** (no mensajes legibles) para que el frontend traduzca via i18n
- Patron: `UPPER_SNAKE_CASE` (ej: `INVALID_PRODUCT_CREDENTIALS`, `AI_RATE_LIMIT_EXCEEDED`)
- Usar excepciones NestJS: `throw new BadRequestException('CODIGO_ERROR')`

Codigos estandar:
```
INVALID_PRODUCT_CREDENTIALS     # Credenciales invalidas al conectar producto
PRODUCT_CONNECTED_SUCCESSFULLY  # Producto conectado exitosamente
PRODUCT_DISCONNECTED_SUCCESSFULLY
PRODUCT_NOT_FOUND
AI_RATE_LIMIT_EXCEEDED          # Rate limit de AI excedido
```

## Endpoints
- Listar: `GET /recurso`
- Detalle: `GET /recurso/:id`
- Crear: `POST /recurso`
- Actualizar: `PATCH /recurso/:id`
- Eliminar: `DELETE /recurso/:id`

## Health Check
Al agregar endpoints nuevos, actualizar la lista esperada en `src/health.controller.ts` para que el health check valide que todos los endpoints estan registrados.
