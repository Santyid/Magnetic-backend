# Security Rules

## JWT Tokens
| Token | Expiracion | Secret |
|-------|-----------|--------|
| Access Token | 15 minutos | `JWT_SECRET` |
| Refresh Token | 7 dias | `JWT_REFRESH_SECRET` |
| SSO Token | 15 minutos | `JWT_SECRET` (compartido con productos) |

- El `JWT_SECRET` NO debe ser el valor default en produccion
- El health check verifica que no sea el default

## Password Rules
5 validaciones obligatorias:
1. Minimo 8 caracteres
2. Al menos un caracter especial (`!@#$%^&*(),.?":{}|<>`)
3. Al menos un numero (0-9)
4. Al menos una letra mayuscula (A-Z)
5. Coincidencia de contrasenas (frontend)

El backend DEBE aplicar las mismas reglas que el frontend.

## Encryption (AES-256-GCM)
- Credenciales de productos se cifran con AES-256-GCM antes de guardar en BD
- Servicio: `src/common/services/encryption.service.ts`
- Variable: `CREDENTIALS_ENCRYPTION_KEY` (64 caracteres hex = 32 bytes)
- Generar: `openssl rand -hex 32`
- Formato cifrado: `iv:authTag:encrypted` (hex separado por `:`)

## Password Recovery
- Token generado con `crypto.randomBytes(32)`, valido por 1 hora
- El token se hashea antes de guardar en BD
- Se marca como `used: true` despues de usar (no reutilizable)
- El endpoint siempre retorna 200 OK (no revela si el email existe)

## CORS
- Configurado via `CORS_ORIGIN` env var
- En Railway DEBE usar `https://` (no `http://`)
- El preflight OPTIONS falla si el origen no coincide exactamente

## Frontend Token Storage
- Tokens en `localStorage`
- Interceptor de Axios para refresh automatico cuando access token expira
- Limpiar tokens al cerrar sesion
- Nunca exponer tokens en URLs

## Credenciales Sensibles
- Nunca loggear passwords o tokens en produccion
- `.env` en `.gitignore`
- Variables criticas: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `DATABASE_PASSWORD`
