# API Reference

Base URL: `http://localhost:3000/api` (dev) | `https://magnetic-backend-production.up.railway.app/api` (prod)

---

## Auth (`/auth`)

### POST /auth/login
Iniciar sesion.
```typescript
Body: { email: string, password: string }
Response: { user: User, accessToken: string, refreshToken: string }
```

### POST /auth/register
Registro de usuario.
```typescript
Body: { email: string, password: string, firstName: string, lastName: string }
Response: { user: User }
```

### POST /auth/refresh
Renovar token.
```typescript
Body: { refreshToken: string }
Response: { accessToken: string, refreshToken: string }
```

### POST /auth/logout
Cerrar sesion actual.
```typescript
Headers: { Authorization: Bearer <token> }
Body: { refreshToken: string }
Response: { message: string }
```

### GET /auth/me
Usuario actual. **Guards:** JWT
```typescript
Headers: { Authorization: Bearer <token> }
Response: User
```

### POST /auth/change-password
Cambiar contrasena (valida actual). **Guards:** JWT
```typescript
Headers: { Authorization: Bearer <token> }
Body: { currentPassword: string, newPassword: string }
Response: { message: "Contrasena actualizada exitosamente" }
Errors: 401 - Contrasena actual incorrecta
```

### POST /auth/forgot-password
Solicitar recuperacion de contrasena. Siempre retorna 200 (no revela si email existe).
```typescript
Body: { email: string }
Response: { message: "Si existe una cuenta con ese email, recibiras instrucciones..." }
```
> Token se loguea en consola. Pendiente integracion de email (SendGrid/AWS SES/Resend).

### POST /auth/reset-password
Resetear contrasena con token.
```typescript
Body: { token: string, newPassword: string }
Response: { message: "Contrasena actualizada exitosamente" }
Errors: 401 - Token invalido/expirado/usado | 400 - newPassword < 6 chars
```

### GET /auth/sessions
Sesiones activas del usuario. **Guards:** JWT
```typescript
Headers: { Authorization: Bearer <token> }
Response: Session[]
```

### POST /auth/logout-all
Cerrar todas las sesiones. **Guards:** JWT
```typescript
Headers: { Authorization: Bearer <token> }
Body: { refreshToken: string }
Response: { message: "Todas las sesiones han sido cerradas" }
```

### DELETE /auth/sessions/:sessionId
Cerrar sesion especifica. **Guards:** JWT
```typescript
Headers: { Authorization: Bearer <token> }
Response: { message: "Sesion cerrada exitosamente" }
Errors: 401 - Sesion no encontrada o no pertenece al usuario
```

---

## Users (`/users`)

### GET /users
Listar todos los usuarios. **Guards:** JWT + Admin
```typescript
Response: User[]
```

### GET /users/:id
Obtener un usuario. **Guards:** JWT
```typescript
Response: User
```

### GET /users/:id/products
Productos de un usuario. **Guards:** JWT + Admin
```typescript
Response: UserProduct[] (con product relation)
```

### POST /users
Crear usuario. **Guards:** JWT + Admin
```typescript
Body: { email: string, password: string, firstName: string, lastName: string, isAdmin?: boolean }
Response: User
```

### PATCH /users/:id
Actualizar usuario. **Guards:** JWT
```typescript
Body: { firstName?: string, lastName?: string, isActive?: boolean }
Response: User
```

### DELETE /users/:id
Eliminar usuario. **Guards:** JWT + Admin
```typescript
Response: { message: string }
```

---

## Products (`/products`)

### GET /products
Listar productos del usuario autenticado. **Guards:** JWT
```typescript
Response: UserProduct[] (con product relation)
```

### GET /products/all
Todos los productos del sistema. **Guards:** JWT + Admin
```typescript
Response: Product[]
```

### GET /products/:slug/access
Generar token SSO para acceder a un producto. **Guards:** JWT
```typescript
Response: { accessToken: string, redirectUrl: string }
```

### POST /products
Crear producto. **Guards:** JWT + Admin
```typescript
Body: { name: string, slug: string, baseUrl: string, description?: string, logoUrl?: string }
Response: Product
```

### POST /products/assign/:userId
Asignar producto a usuario. **Guards:** JWT + Admin
```typescript
Body: { productId: string, externalUserId: string, customDomain?: string, metadata?: object }
Response: UserProduct
```

### PATCH /products/assign/:userProductId
Actualizar asignacion. **Guards:** JWT + Admin
```typescript
Body: { externalUserId?: string, customDomain?: string, metadata?: object, isActive?: boolean }
Response: UserProduct (con product y user relations)
```

### DELETE /products/:productId/user/:userId
Remover producto de usuario. **Guards:** JWT + Admin
```typescript
Response: { message: string }
```

### POST /products/credentials/:userProductId
Guardar credenciales cifradas (admin, sin validacion). **Guards:** JWT + Admin
```typescript
Body: { productEmail?: string, password?: string, apiToken?: string, enableMetrics?: boolean }
Response: UserProduct
```

### DELETE /products/credentials/:userProductId
Borrar credenciales. **Guards:** JWT + Admin
```typescript
Response: UserProduct (campos en null)
```

---

## Dashboard (`/dashboard`)

### POST /dashboard/connect/:userProductId
Conectar producto (valida credenciales contra API externa). **Guards:** JWT
```typescript
Body: { productEmail: string, password: string, subdomain?: string, apiToken?: string }
Response (200): { connected: true, message: "PRODUCT_CONNECTED_SUCCESSFULLY", product: { name, slug } }
Response (400): { statusCode: 400, message: "INVALID_PRODUCT_CREDENTIALS" }
Response (404): { statusCode: 404, message: "PRODUCT_NOT_FOUND" }
```

### DELETE /dashboard/connect/:userProductId
Desconectar producto (borra credenciales). **Guards:** JWT
```typescript
Response: { connected: false, message: "PRODUCT_DISCONNECTED_SUCCESSFULLY", product: { name, slug } }
```

### GET /dashboard/metrics
Metricas unificadas de todos los productos conectados. **Guards:** JWT
```typescript
Response: {
  metrics: [{
    productSlug: string,
    productName: string,
    metrics: { data: { acumulateValuation, totalEngagement, totalContent, ... } }
  }]
}
```

### POST /dashboard/sync/:userProductId
Forzar re-sincronizacion de metricas. **Guards:** JWT
```typescript
Response: (mismo formato que item individual de /dashboard/metrics)
```

---

## AI (`/ai`)

### POST /ai/chat
Chat con asistente AI. **Guards:** JWT
```typescript
Body: { message: string, history?: { role: 'user'|'assistant', content: string }[] }
Response (200): { reply: string, usage: { promptTokens, completionTokens, totalTokens } }
Response (429): { statusCode: 429, message: "AI_RATE_LIMIT_EXCEEDED", retryAfter: number }
```
- Rate limit: 20 mensajes/hora por usuario
- Modelo: gpt-4o-mini (~$0.0002/mensaje)
- System prompt dinamico con productos del usuario

---

## Health (`/health`)

### GET /health
Health check publico. **Guards:** Ninguno
```typescript
Response: {
  status: "ok" | "degraded",
  timestamp: string,
  service: "Login Magnetic Backend",
  uptime: number,
  environment: string,
  services: { database, openai, encryption, jwt: { status: "ok"|"error" } },
  endpoints: { auth, users, products, dashboard, ai, health: { status, routes[], missing? } }
}
```
Servicios verificados: PostgreSQL (SELECT 1), OPENAI_API_KEY, CREDENTIALS_ENCRYPTION_KEY (64 hex), JWT_SECRET (no default).
