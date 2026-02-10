# Authentication & SSO Flow

## Login Flow
```
Usuario → POST /api/auth/login { email, password }
  → Backend valida credenciales
  → Crea Session en BD
  → Retorna { user, accessToken, refreshToken }
  → Frontend guarda tokens en localStorage
  → Redirige a /dashboard (normal) o /admin (isAdmin)
```

## Token Refresh
```
Access token expira (15 min)
  → Axios interceptor detecta 401
  → POST /api/auth/refresh { refreshToken }
  → Backend genera nuevos tokens
  → Interceptor reintenta request original
  → Si refresh falla → redirect a /login
```

## SSO Flow (Single Sign-On)
Un unico `JWT_SECRET` global se configura en el `.env` de Magnetic Y de cada producto.

```
1. Usuario tiene en Magnetic:
   - externalUserId: "admin@fluvip.com" (para Advocates)
   - customDomain: "qa.advocatespro.com"

2. Click en "Advocates" en Dashboard

3. Frontend → GET /api/products/advocates/access
   Backend genera JWT con:
   {
     sub: "admin@fluvip.com",    // externalUserId
     magneticUserId: "uuid",
     product: "advocates"
   }
   Firmado con JWT_SECRET compartido

4. Backend responde:
   {
     accessToken: "eyJhb...",
     redirectUrl: "https://qa.advocatespro.com/auth/sso?token=eyJhb..."
   }

5. Frontend abre URL en nueva pestana (window.open)

6. Producto recibe token, valida con el MISMO JWT_SECRET,
   extrae sub="admin@fluvip.com" y autentica al usuario
```

### Requisito en cada producto externo
Cada producto solo necesita **un endpoint nuevo**:
```
GET /auth/sso?token=<jwt>
```
Valida JWT con `JWT_SECRET` compartido, extrae `sub`, busca usuario en su BD, crea sesion local.

## Password Recovery Flow
```
1. POST /auth/forgot-password { email }
   → Genera token con crypto.randomBytes(32)
   → Hashea token, guarda en BD (valido 1 hora)
   → Loguea token en consola (pendiente email service)
   → Siempre retorna 200 OK (seguridad)

2. Usuario recibe email con link:
   https://magnetic-frontend.com/reset-password?token=abc123

3. POST /auth/reset-password { token, newPassword }
   → Valida token (no expirado, no usado)
   → Actualiza contrasena
   → Marca token como used: true
```

## Session Management
- `GET /auth/sessions` → Lista sesiones activas del usuario
- `DELETE /auth/sessions/:sessionId` → Cerrar sesion especifica
- `POST /auth/logout-all` → Cerrar todas las sesiones
- Cada sesion registra: IP, User-Agent, fecha de creacion, expiracion

## Frontend Route Guards
| Componente | Verifica |
|-----------|----------|
| `ProtectedRoute` | `isAuthenticated` (redirige a /login) |
| `AdminRoute` | `isAuthenticated + isAdmin` (redirige a /dashboard) |

Ambos guards muestran spinner mientras `isCheckingAuth === true` para evitar race condition con `checkAuth()` async.

## Frontend Auth Store (Zustand)
```typescript
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  login(email, password): Promise<void>;
  logout(): void;
  checkAuth(): Promise<void>;
  refreshTokens(): Promise<void>;
}
```
