# Login Magnetic - Contexto del Proyecto

## 🎯 Objetivo Principal
Crear un sistema de autenticación unificado (SSO - Single Sign-On) llamado **Login Magnetic** que centralice el acceso a los 4 productos de la empresa sin modificar sus arquitecturas existentes.

---

## 🏢 Productos a Integrar

| Producto | Descripción | Particularidades |
|----------|-------------|------------------|
| **SocialGest** | Gestión de redes sociales | Base de datos independiente |
| **Tikket** | Sistema de tickets/soporte | Base de datos independiente |
| **Advocates** | Plataforma de advocacy | **Subdominios personalizados** por cliente (ej: `cliente.advocates.com`) |
| **Quantico** | Analytics/Métricas | Base de datos independiente |

---

## 🚫 Restricciones Críticas

1. **NO modificar** las bases de datos existentes de los productos
2. **NO modificar** los servicios backend de los productos existentes
3. **NO modificar** la configuración actual de cada producto
4. Cada producto mantiene su **autonomía total**
5. Login Magnetic debe ser **100% independiente**

---

## 🏗️ Arquitectura Definida

### Stack Tecnológico
- **Backend:** Node.js + NestJS
- **Frontend:** React + TypeScript
- **Base de datos:** PostgreSQL (nueva, solo para Login Magnetic)
- **Autenticación:** JWT + Refresh Tokens
- **Comunicación entre productos:** Tokens firmados + Cookies seguras

### Estructura de Repositorios
```
magnetic-backend/    # API NestJS
magnetic-frontend/   # App React
```

### Estrategia de Integración
- **Método:** Redirección con tokens JWT (NO iframes)
- **Razón:** Los subdominios de Advocates y restricciones de seguridad hacen inviable el uso de iframes
- **Flujo:** Login Magnetic genera token → redirige al producto → producto valida token

---

## 🔐 Flujo de Autenticación

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Usuario llega  │────▶│  Login Magnetic  │────▶│  Dashboard con  │
│  a cualquier    │     │  (Autenticación) │     │  sus productos  │
│  producto       │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                               ┌─────────────────────┐
                                               │ Click en producto:  │
                                               │ - SocialGest        │
                                               │ - Tikket            │
                                               │ - Advocates         │
                                               │ - Quantico          │
                                               └─────────────────────┘
                                                          │
                                                          ▼
                                               ┌─────────────────────┐
                                               │ Redirección con     │
                                               │ token JWT firmado   │
                                               │ al producto destino │
                                               └─────────────────────┘
```

---

## 📊 Modelo de Datos (Login Magnetic)

### Entidades Principales

```typescript
// Usuario unificado
User {
  id: UUID
  email: string (único)
  password: string (hash)
  firstName: string
  lastName: string
  avatar?: string
  isActive: boolean
  createdAt: DateTime
  updatedAt: DateTime
}

// Productos disponibles
Product {
  id: UUID
  name: string // SocialGest, Tikket, Advocates, Quantico
  slug: string
  baseUrl: string
  logoUrl: string
  isActive: boolean
}

// Relación Usuario-Producto (qué productos tiene cada usuario)
UserProduct {
  id: UUID
  userId: UUID
  productId: UUID
  externalUserId: string // ID del usuario en el sistema externo
  customDomain?: string // Para Advocates: subdominio personalizado
  productEmail?: string // 🆕 Email del usuario en el producto externo
  encryptedPassword?: string // 🆕 Contraseña cifrada AES-256-GCM
  apiToken?: string // 🆕 Token API cifrado (alternativa a password)
  enableMetrics: boolean // 🆕 Si se muestran métricas en dashboard (default: false)
  metadata?: JSON // Datos adicionales específicos del producto
  isActive: boolean
  createdAt: DateTime
}

// Sesiones activas
Session {
  id: UUID
  userId: UUID
  token: string
  refreshToken: string
  expiresAt: DateTime
  ipAddress: string
  userAgent: string
  createdAt: DateTime
}
```

---

## 🔑 Endpoints API (Backend) - ✅ COMPLETO

### Autenticación (`/auth`)
```
POST   /auth/login                     # Iniciar sesión
POST   /auth/register                  # Registro de usuario
POST   /auth/refresh                   # Renovar token
POST   /auth/logout                    # Cerrar sesión actual
GET    /auth/me                        # Usuario actual
POST   /auth/change-password           # 🆕 Cambiar contraseña (valida actual)
POST   /auth/forgot-password           # 🆕 Solicitar recuperación de contraseña
POST   /auth/reset-password            # 🆕 Resetear contraseña con token
GET    /auth/sessions                  # 🆕 Sesiones activas del usuario
POST   /auth/logout-all                # 🆕 Cerrar todas las sesiones
DELETE /auth/sessions/:sessionId       # 🆕 Cerrar sesión específica
```

### Productos (`/products`)
```
GET    /products                       # Listar productos del usuario autenticado
GET    /products/all                   # 🆕 Todos los productos (Admin)
GET    /products/:slug/access          # Generar token SSO
POST   /products                       # Crear producto (Admin)
POST   /products/assign/:userId        # Asignar producto a usuario (Admin)
PATCH  /products/assign/:userProductId # 🆕 Actualizar asignación (Admin)
DELETE /products/:productId/user/:userId # Remover producto de usuario (Admin)
```

### Usuarios (`/users`)
```
GET    /users                          # Listar todos los usuarios (Admin)
GET    /users/:id                      # Obtener un usuario
GET    /users/:id/products             # 🆕 Productos de un usuario (Admin)
POST   /users                          # Crear usuario (Admin)
PATCH  /users/:id                      # Actualizar usuario
DELETE /users/:id                      # Eliminar usuario (Admin)
```

### Health Check (`/health`)
```
GET    /health                         # 🆕 Health check (público)
```

### Asistente AI (`/ai`)
```
POST   /ai/chat                        # 🆕 Chat con asistente AI (requiere JWT)
```

### Credenciales de Productos (`/products/credentials`) - Admin
```
POST   /products/credentials/:userProductId   # 🆕 Guardar credenciales cifradas (Admin)
DELETE /products/credentials/:userProductId   # 🆕 Borrar credenciales (Admin)
```

### Dashboard - Conexión y Métricas (`/dashboard`)
```
POST   /dashboard/connect/:userProductId      # 🆕 Conectar producto (Usuario - valida credenciales)
DELETE /dashboard/connect/:userProductId      # 🆕 Desconectar producto (Usuario)
GET    /dashboard/metrics                     # 🆕 Métricas unificadas (Usuario)
POST   /dashboard/sync/:userProductId         # 🆕 Forzar sync de métricas (Usuario)
```

### 📝 Detalles de Nuevos Endpoints

#### POST /auth/change-password 🆕
Permite al usuario cambiar su contraseña validando primero la contraseña actual.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
Body: {
  currentPassword: string;
  newPassword: string;
}
```

**Response:**
```json
{
  "message": "Contraseña actualizada exitosamente"
}
```

**Errores:**
- `401 Unauthorized` - La contraseña actual es incorrecta
- `401 Unauthorized` - Token inválido o expirado

---

#### GET /auth/sessions 🆕
Obtiene todas las sesiones activas del usuario autenticado.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
```

**Response:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "token": "jwt...",
    "refreshToken": "jwt...",
    "expiresAt": "2026-02-05T...",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "createdAt": "2026-01-29T..."
  }
]
```

---

#### POST /auth/logout-all 🆕
Cierra todas las sesiones del usuario (útil si detecta acceso no autorizado).

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
Body: {
  refreshToken: string;
}
```

**Response:**
```json
{
  "message": "Todas las sesiones han sido cerradas"
}
```

---

#### DELETE /auth/sessions/:sessionId 🆕
Cierra una sesión específica por su ID.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
Params: { sessionId: "uuid" }
```

**Response:**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

**Errores:**
- `401 Unauthorized` - Sesión no encontrada o no pertenece al usuario

---

#### GET /products/all 🆕
Obtiene todos los productos disponibles (solo Admin). Útil para asignar productos a usuarios.

**Request:**
```typescript
Headers: { Authorization: Bearer <adminToken> }
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "SocialGest",
    "slug": "socialgest",
    "baseUrl": "https://socialgest.com",
    "description": "Gestión de redes sociales",
    "logoUrl": "...",
    "isActive": true
  },
  // ... más productos
]
```

**Guards:** JWT + Admin

---

#### PATCH /products/assign/:userProductId 🆕
Actualiza una asignación existente de producto a usuario. Permite cambiar externalUserId, customDomain, metadata o isActive sin eliminar y recrear.

**Request:**
```typescript
Headers: { Authorization: Bearer <adminToken> }
Params: { userProductId: "uuid" }
Body: {
  externalUserId?: string;
  customDomain?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "productId": "uuid",
  "externalUserId": "nuevo-id-123",
  "customDomain": "empresa.advocates.com",
  "metadata": { "role": "admin" },
  "isActive": true,
  "product": { ... },
  "user": { ... }
}
```

**Guards:** JWT + Admin

---

#### GET /users/:userId/products 🆕
Obtiene todos los productos asignados a un usuario específico (solo Admin).

**Request:**
```typescript
Headers: { Authorization: Bearer <adminToken> }
Params: { userId: "uuid" }
```

**Response:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "productId": "uuid",
    "externalUserId": "user-socialgest-001",
    "customDomain": null,
    "metadata": { "role": "user" },
    "isActive": true,
    "product": {
      "id": "uuid",
      "name": "SocialGest",
      "slug": "socialgest",
      "baseUrl": "https://socialgest.com",
      "description": "Gestión de redes sociales"
    }
  }
]
```

**Guards:** JWT + Admin

---

#### GET /health 🆕
Endpoint público para health checks de load balancers, monitoreo, etc.

**Request:**
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T10:30:00.000Z",
  "service": "Login Magnetic Backend",
  "uptime": 12345.67
}
```

**Guards:** Ninguno (público)

---

#### POST /ai/chat 🆕
Envía un mensaje al asistente de IA que conoce los productos del usuario y puede responder preguntas sobre ellos.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
Body: {
  message: string;         // Mensaje del usuario
  history?: [              // Opcional: historial de conversación
    {
      role: 'user' | 'assistant';
      content: string;
    }
  ];
}
```

**Response (200 OK):**
```json
{
  "reply": "Tienes acceso a los siguientes productos: SocialGest, Tikket...",
  "usage": {
    "promptTokens": 339,
    "completionTokens": 65,
    "totalTokens": 404
  }
}
```

**Response (429 Too Many Requests):**
```json
{
  "statusCode": 429,
  "message": "AI_RATE_LIMIT_EXCEEDED",
  "retryAfter": 3456
}
```

**Características:**
- **System Prompt Dinámico**: Se construye automáticamente con los productos asignados al usuario
- **Rate Limiting**: 20 mensajes por hora por usuario
- **Multiidioma**: Detecta y responde en español, inglés o portugués
- **Restricción por Productos**: Solo responde sobre productos que el usuario tiene asignados
- **Modelo**: gpt-4o-mini (económico, ~$0.0002 por mensaje)

**Ejemplo de uso:**
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Qué productos tengo disponibles?"}'
```

**Guards:** JWT (requiere autenticación)

**Costo estimado:**
- Mensaje promedio: ~350 tokens
- Costo por mensaje: ~$0.0002
- 1000 mensajes/día: ~$0.20/día
- 30,000 mensajes/mes: ~$6/mes

---

#### POST /auth/forgot-password 🆕
Genera un token de recuperación de contraseña y lo envía por email (actualmente loguea en consola).

**Request:**
```typescript
Body: {
  email: string;
}
```

**Response:**
```json
{
  "message": "Si existe una cuenta con ese email, recibirás instrucciones para recuperar tu contraseña"
}
```

**Notas:**
- El token se genera usando `crypto.randomBytes(32)` y es válido por 1 hora
- ⚠️ **IMPORTANTE**: Actualmente el token se loguea en consola del servidor. En producción se debe integrar un servicio de email (SendGrid, AWS SES, Resend, etc.)
- El endpoint siempre retorna el mismo mensaje por seguridad (no revela si el email existe o no)

**Errores:**
- Ninguno (siempre retorna 200 OK por seguridad)

**Entity:** `PasswordResetToken`
```typescript
{
  id: UUID
  userId: UUID
  token: string        // Hash del token
  expiresAt: DateTime  // 1 hora desde creación
  used: boolean        // Se marca true después de usar
  createdAt: DateTime
}
```

---

#### POST /auth/reset-password 🆕
Resetea la contraseña de un usuario usando un token válido de recuperación.

**Request:**
```typescript
Body: {
  token: string;       // Token recibido por email
  newPassword: string; // Mínimo 6 caracteres
}
```

**Response:**
```json
{
  "message": "Contraseña actualizada exitosamente"
}
```

**Errores:**
- `401 Unauthorized` - Token inválido, expirado, o ya usado
- `400 Bad Request` - newPassword no cumple validación (< 6 caracteres)

**Flujo completo:**
1. Usuario solicita recuperación: `POST /auth/forgot-password`
2. Sistema genera token y envía email (actualmente loguea en consola)
3. Usuario recibe email con link: `https://magnetic-frontend.com/reset-password?token=abc123`
4. Frontend captura token del query param
5. Usuario ingresa nueva contraseña
6. Frontend envía: `POST /auth/reset-password` con token + newPassword
7. Backend valida token y actualiza contraseña
8. Token se marca como `used: true` (no puede reutilizarse)

---

## 🔗 Dashboard - Conexión de Productos y Métricas (✅ IMPLEMENTADO)

### Concepto

El modelo híbrido combina SSO (acceso directo) con un Agregador de métricas. El flujo es:

1. **Admin asigna producto** a un usuario (sin credenciales, solo la relación)
2. **Usuario ve el producto** en su dashboard como "no conectado"
3. **Usuario llena formulario de conexión** con sus credenciales del producto externo
4. **Backend valida credenciales** contra la API real del producto
5. Si son válidas → las guarda **cifradas con AES-256-GCM** → responde "conectado"
6. Si son inválidas → responde error → el usuario puede reintentar
7. Una vez conectado, el dashboard puede mostrar **métricas** del producto

### Cifrado de Credenciales

Las credenciales se cifran con **AES-256-GCM** usando la variable `CREDENTIALS_ENCRYPTION_KEY` (32 bytes hex).

**Archivos:**
- `src/common/services/encryption.service.ts` — Servicio de cifrado/descifrado
- Variable de entorno: `CREDENTIALS_ENCRYPTION_KEY` (generar con `openssl rand -hex 32`)

### Campos nuevos en UserProduct

```typescript
productEmail?: string;        // Email del usuario en el producto externo
encryptedPassword?: string;   // Contraseña cifrada con AES-256-GCM
apiToken?: string;            // Token API cifrado (alternativa)
enableMetrics: boolean;       // Si se muestran métricas (default: false)
```

---

### POST /dashboard/connect/:userProductId 🆕
El **usuario** conecta su producto enviando sus credenciales. El backend las valida contra la API del producto antes de guardarlas.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
Params: { userProductId: "uuid" }
Body: {
  productEmail: string;      // Email O username en el producto externo (ej: "admin_adpro_dev")
  password: string;          // Contraseña en texto plano (se cifra antes de guardar)
  subdomain?: string;        // Para Advocates (ej: "qa")
  apiToken?: string;         // Alternativa a password
}
```

**Response (200 OK) - Conexión exitosa:**
```json
{
  "connected": true,
  "message": "PRODUCT_CONNECTED_SUCCESSFULLY",
  "product": {
    "name": "Advocates",
    "slug": "advocates"
  }
}
```

**Response (400 Bad Request) - Credenciales inválidas:**
```json
{
  "statusCode": 400,
  "message": "INVALID_PRODUCT_CREDENTIALS"
}
```

**Response (404 Not Found) - Producto no asignado:**
```json
{
  "statusCode": 404,
  "message": "PRODUCT_NOT_FOUND"
}
```

**Guards:** JWT (cualquier usuario autenticado, solo sus propios productos)

**Flujo interno:**
1. Busca la asignación `userProductId` del usuario autenticado
2. Según el slug del producto, intenta autenticarse contra la API externa
3. Si la autenticación es exitosa → cifra password con AES-256-GCM → guarda en DB → `enableMetrics = true`
4. Si falla → retorna `INVALID_PRODUCT_CREDENTIALS`

**Mapeo de códigos para i18n en el frontend:**

| Código | ES | EN | PT |
|--------|----|----|-----|
| `PRODUCT_CONNECTED_SUCCESSFULLY` | Producto conectado exitosamente | Product connected successfully | Produto conectado com sucesso |
| `INVALID_PRODUCT_CREDENTIALS` | Credenciales inválidas. Verifica tu email y contraseña | Invalid credentials. Check your email and password | Credenciais inválidas. Verifique seu email e senha |
| `PRODUCT_NOT_FOUND` | Producto no encontrado | Product not found | Produto não encontrado |

---

### DELETE /dashboard/connect/:userProductId 🆕
El **usuario** desconecta su producto. Se borran todas las credenciales cifradas.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
Params: { userProductId: "uuid" }
```

**Response (200 OK):**
```json
{
  "connected": false,
  "message": "PRODUCT_DISCONNECTED_SUCCESSFULLY",
  "product": {
    "name": "Advocates",
    "slug": "advocates"
  }
}
```

**Guards:** JWT

**Mapeo i18n:**

| Código | ES | EN | PT |
|--------|----|----|-----|
| `PRODUCT_DISCONNECTED_SUCCESSFULLY` | Producto desconectado | Product disconnected | Produto desconectado |

---

### GET /dashboard/metrics 🆕
Obtiene las métricas unificadas de todos los productos conectados del usuario.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
```

**Response (200 OK):**
```json
{
  "metrics": [
    {
      "productSlug": "advocates",
      "productName": "Advocates",
      "metrics": {
        "data": {
          "acumulateValuation": "50718391.29",
          "acumulateValuationReal": 14012.5,
          "totalEngagement": 285,
          "totalContent": 715,
          "totalPotentialReach": 331599,
          "totalEstimatedReach": 63809,
          "totalCampaigns": 1211,
          "activeCampaigns": 5,
          "totalGroups": 35,
          "totalAmbassadors": 190,
          "ambassadorsParticipating": 33,
          "totalBonus": 166,
          "totalBonusApproved": 104,
          "totalBonusPending": 38,
          "totalBonusRejected": 24,
          "totalChallenges": 291,
          "totalActiveChallenges": 0,
          "totalContentsChallenges": 68
        }
      }
    }
  ]
}
```

**Mapeo de métricas para tarjetas del dashboard (AdvocatesPro):**

| Tarjeta | Campo API | Formato | Icono sugerido |
|---------|-----------|---------|----------------|
| Valorización acumulada | `acumulateValuation` | `$${(val/1000000).toFixed(2)}M COP` | 💰 (dólar) |
| Interacciones totales | `totalEngagement` | Número directo | ❤️ (corazón) |
| Total contenidos | `totalContent` | Número directo | 📋 (clipboard) |
| Alcance potencial | `totalPotentialReach` | `${(val/1000).toFixed(2)}K` | 📡 (señal) |
| Alcance estimado | `totalEstimatedReach` | `${(val/1000).toFixed(2)}K` | 📈 (gráfica) |

**Notas:**
- Solo retorna productos con `enableMetrics: true` y credenciales guardadas
- Si un producto falla al obtener métricas, retorna `error` en vez de `metrics`
- Actualmente solo AdvocatesPro tiene conector implementado
- ✅ **Probado y funcional** con credenciales reales de Advocates QA

**Guards:** JWT

**Pruebas realizadas:**
- ✅ Conexión exitosa: `POST /dashboard/connect/:id` con `{ productEmail: "admin_adpro_dev", password: "AD_adpro_2022", subdomain: "qa" }`
- ✅ Métricas retornadas: `GET /dashboard/metrics` retorna datos reales de AdvocatesPro
- ✅ Datos coinciden con el dashboard real de AdvocatesPro (valorización ~$50.18M, engagement 285, contenidos 715, etc.)

---

### POST /dashboard/sync/:userProductId 🆕
Fuerza una re-sincronización de métricas de un producto específico.

**Request:**
```typescript
Headers: { Authorization: Bearer <token> }
Params: { userProductId: "uuid" }
```

**Response:** Igual que el item individual en `/dashboard/metrics`

**Guards:** JWT

---

### POST /products/credentials/:userProductId 🆕 (Admin)
El **admin** guarda credenciales de un producto directamente sin validación. Útil para configuración masiva.

**Request:**
```typescript
Headers: { Authorization: Bearer <adminToken> }
Params: { userProductId: "uuid" }
Body: {
  productEmail?: string;
  password?: string;       // Se cifra automáticamente
  apiToken?: string;       // Se cifra automáticamente
  enableMetrics?: boolean;
}
```

**Response:** El objeto UserProduct actualizado.

**Guards:** JWT + Admin

---

### DELETE /products/credentials/:userProductId 🆕 (Admin)
El **admin** borra las credenciales de un producto. Resetea `productEmail`, `encryptedPassword`, `apiToken` y `enableMetrics`.

**Request:**
```typescript
Headers: { Authorization: Bearer <adminToken> }
Params: { userProductId: "uuid" }
```

**Response:** El objeto UserProduct actualizado (con campos en null).

**Guards:** JWT + Admin

---

### 🎨 Frontend - Conexión de Producto y Métricas (✅ IMPLEMENTADO)

#### Vista del usuario en Dashboard

Cada tarjeta de producto muestra uno de estos estados:

1. **No conectado** — Badge gris "No conectado", botón outline "Conectar" → abre `ConnectProductModal`
2. **Conectado** — Badge verde "Conectado", botón "Acceder" → navega a `/dashboard/metrics/:slug`, link "Abrir producto" → SSO redirect
3. **Error de conexión** — Panel rojo con botón "Reconectar"

#### Detección de conexión
```typescript
const isConnected = userProduct.productEmail && userProduct.enableMetrics;
```

#### ConnectProductModal (`src/components/dashboard/ConnectProductModal.tsx`)
- Modal overlay con formulario: email/usuario + contraseña (con toggle mostrar/ocultar) + subdominio (solo Advocates)
- Label: "Email o usuario" / "Email or username" / "Email ou usuário"
- Llama `dashboardAPI.connectProduct()`, maneja `INVALID_PRODUCT_CREDENTIALS`
- Toast success/error con react-hot-toast

#### Página de Métricas (`src/pages/ProductMetrics.tsx`)
- Ruta: `/dashboard/metrics/:slug`
- Stat cards en grid 3 columnas: valorización acumulada, interacciones, contenidos, alcance potencial, alcance estimado
- TopBanner con tabs de productos, botones AI y Help
- Botón "Sincronizar" y "Abrir producto" (SSO)
- Si no conectado → mensaje + botón conectar
- Si error → panel rojo + botón reconectar

#### Traducciones i18n (sección `metrics` en translations.ts) ✅
~25 keys en ES/EN/PT: connect, disconnect, reconnect, connected, disconnected, connectionError, connectTitle, connectSubtitle, emailLabel ("Email o usuario"), passwordLabel, subdomainLabel, subdomainHelp, connecting, disconnectConfirm, metricsTitle, syncNow, syncing, noMetrics, backToDashboard, openProduct, accumulatedValue, totalInteractions, totalContent, potentialReach, estimatedReach

#### Panel Admin - Estado de conexión (✅ IMPLEMENTADO)
- **AssignProducts**: Badge "Conectado"/"No conectado" por cada producto asignado
- API admin: `productsAPI.saveCredentials()` y `productsAPI.deleteCredentials()`

#### API Frontend (dashboardAPI + productsAPI en `src/services/api.ts`)
```typescript
dashboardAPI.connectProduct(userProductId, data)    // POST /dashboard/connect/:id
dashboardAPI.disconnectProduct(userProductId)        // DELETE /dashboard/connect/:id
dashboardAPI.getMetrics()                            // GET /dashboard/metrics
dashboardAPI.syncProduct(userProductId)              // POST /dashboard/sync/:id
productsAPI.saveCredentials(userProductId, data)     // POST /products/credentials/:id (Admin)
productsAPI.deleteCredentials(userProductId)          // DELETE /products/credentials/:id (Admin)
```

---

### Conectores de Productos (Backend)

| Producto | Conector | Estado | API Base |
|----------|----------|--------|----------|
| AdvocatesPro | `advocates.connector.ts` | ✅ Implementado | `https://api.qa.advocatespro.com` |
| SocialGest | — | ❌ Pendiente | Por definir |
| Tikket | — | ❌ Pendiente | Por definir |
| Quantico | — | ❌ Pendiente | Por definir |

**Advocates Connector - Endpoints usados:**
- Login: `POST https://api.qa.advocatespro.com/login` → `{ email, password, subdomain }`
- Métricas: `GET https://api.qa.advocatespro.com/get-metrics-dashboard-admin?typeFilter=all&year=YYYY`

**Archivos:**
```
src/modules/dashboard/
├── dashboard.module.ts
├── dashboard.controller.ts
├── dashboard.service.ts
└── connectors/
    └── advocates.connector.ts
```

---

## 🔄 Modelo Híbrido - SSO + Agregador de Métricas (Futuro)

### ⚠️ Estado: Propuesta pendiente de validación con Lead Developers

Esta sección documenta una **propuesta de arquitectura alternativa/complementaria** al modelo SSO puro. Antes de implementar, se debe validar con el Lead Developer de cada producto la disponibilidad y permisos de sus APIs públicas.

### 🎯 Motivación

El modelo SSO actual permite redirigir al usuario a cada producto con autenticación automática. Sin embargo, se identificó una oportunidad adicional:

**¿Qué tal si Magnetic Suite pudiera mostrar métricas/dashboard unificado de todos los productos en un solo lugar?**

Por ejemplo:
- Total de posts programados en SocialGest
- Tickets abiertos en Tikket
- Advocates activos en AdvocatesPro
- Conversiones en Quantico

### 🏗️ Arquitectura Propuesta

```
┌──────────────────────────────────────────────────────┐
│              Magnetic Suite Dashboard                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ SocialGest │  │   Tikket   │  │  Advocates │    │
│  │ 150 posts  │  │  23 open   │  │  45 activos│    │
│  │ programados│  │   tickets  │  │            │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│                                                      │
│  [Botón "Acceder a SocialGest" con SSO]            │
└──────────────────────────────────────────────────────┘
           │                      ▲
           │ SSO Token            │ Métricas API
           ▼                      │
   ┌──────────────┐      ┌────────────────┐
   │  SocialGest  │◀─────│ Magnetic API   │
   │  (producto)  │      │ (hace query)   │
   └──────────────┘      └────────────────┘
```

**Modelo Híbrido = SSO (acceso directo) + Agregador (métricas centralizadas)**

### 📊 Nuevo Modelo de Datos (Propuesto)

#### Entity: `UserProductConnection`
```typescript
@Entity('user_product_connections')
export class UserProductConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  productId: string;

  // Para SSO (como antes)
  @Column()
  externalUserId: string;      // ID del usuario en el producto externo

  @Column({ nullable: true })
  customDomain?: string;        // Para Advocates

  // NUEVO: Para Dashboard Aggregator
  @Column({ nullable: true })
  productEmail?: string;        // Email del usuario en el producto (puede diferir del email en Magnetic)

  @Column({ type: 'text', nullable: true })
  encryptedPassword?: string;   // Contraseña cifrada con AES-256-GCM

  @Column({ nullable: true })
  apiToken?: string;            // Si el producto usa API tokens en vez de user/pass

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    lastSync?: Date;
    lastMetrics?: Record<string, any>;
    syncFrequency?: number;     // Minutos entre syncs
  };

  @Column({ default: true })
  enableSSO: boolean;           // ¿Permitir acceso directo con SSO?

  @Column({ default: false })
  enableMetricsAggregator: boolean;  // ¿Mostrar métricas en dashboard?

  @Column({ default: true })
  isActive: boolean;

  @CreatedAt()
  createdAt: Date;

  @UpdatedAt()
  updatedAt: Date;
}
```

### 🔐 Seguridad de Credenciales

Si se implementa el Dashboard Aggregator, las credenciales de productos se cifrarán con **AES-256-GCM**:

```typescript
// Ejemplo de cifrado (NO implementado aún)
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY; // 32 bytes
const algorithm = 'aes-256-gcm';

function encryptPassword(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decryptPassword(ciphertext: string): string {
  const parts = ciphertext.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**Variables de entorno necesarias:**
```env
CREDENTIALS_ENCRYPTION_KEY=<64 caracteres hex (32 bytes)>
```

### 🔌 Conectores de Productos (Propuesto)

Cada producto necesitaría un **conector** que sepa cómo autenticarse y extraer métricas:

```typescript
// Ejemplo: advocates.connector.ts (NO implementado)
interface ProductConnector {
  authenticate(credentials: ProductCredentials): Promise<AuthToken>;
  getMetrics(token: AuthToken): Promise<ProductMetrics>;
}

interface ProductCredentials {
  email: string;
  password: string;
  subdomain?: string;  // Para Advocates
}

interface AuthToken {
  accessToken: string;
  expiresAt: Date;
}

interface ProductMetrics {
  productId: string;
  userId: string;
  metrics?: Record<string, any>;  // Estructura flexible, cada producto define su schema
  fetchedAt: Date;
}

// Ejemplo de métricas de Advocates
{
  productId: 'advocates-uuid',
  userId: 'user-uuid',
  metrics: {
    totalAdvocates: 45,
    activeAdvocates: 38,
    postsThisMonth: 120,
    engagement: 0.78,
    topAdvocates: [
      { name: 'Juan Pérez', posts: 15 },
      { name: 'María González', posts: 12 }
    ]
  },
  fetchedAt: '2026-01-29T10:00:00Z'
}
```

### 🧪 Prueba de Concepto - Advocates API

Se validó que la API de Advocates es **pública y funcional**:

**Endpoint:** `https://api.qa.advocatespro.com/login`

**Request:**
```json
{
  "email": "admin_adpro_dev",
  "password": "AD_adpro_2022",
  "subdomain": "qa"
}
```

**Response (exitoso):**
```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Admin QA",
      "email": "admin_adpro_dev",
      "role": "admin",
      ...
    }
  }
}
```

✅ **Conclusion:** Advocates tiene API pública funcional. Otros productos (SocialGest, Tikket, Quantico) necesitan ser validados.

### 📝 Endpoints API Propuestos (NO implementados)

```typescript
// Gestión de credenciales de productos
POST   /products/credentials/:userId/:productId    # Admin guarda credenciales cifradas
DELETE /products/credentials/:userProductId        # Admin elimina credenciales

// Dashboard Aggregator
GET    /dashboard/metrics                          # Usuario ve métricas unificadas
POST   /dashboard/sync/:productId                  # Forzar sync de métricas de un producto
```

### ⚠️ Consideraciones Importantes

#### 1. Cada producto tiene métricas diferentes
- **SocialGest**: Posts programados, engagement, seguidores
- **Tikket**: Tickets abiertos, tiempo respuesta, satisfacción
- **Advocates**: Advocates activos, posts amplificados, alcance
- **Quantico**: Conversiones, ROI, dashboards guardados

**Solución:** El campo `metrics` es `Record<string, any>` (JSON flexible). Cada conector define su propia estructura.

#### 2. Autenticación varía por producto
- **Advocates**: email + password + subdomain
- **Otros productos**: Pueden usar API tokens, OAuth, etc.

**Solución:** El modelo soporta tanto `encryptedPassword` como `apiToken`. Cada conector implementa su lógica.

#### 3. El usuario debe poder acceder DIRECTAMENTE al producto
Este modelo NO reemplaza el SSO, lo **complementa**:
- **SSO (existente)**: Usuario hace click y se redirige al producto con JWT
- **Aggregator (propuesto)**: Magnetic consulta APIs de productos para mostrar métricas

Ambos pueden coexistir:
```typescript
enableSSO: true                 // ✅ Botón "Acceder" funciona
enableMetricsAggregator: true   // ✅ Dashboard muestra métricas
```

### 🚦 Próximos Pasos (Solo si se aprueba)

1. **Validación con Lead Developers** ✋ **CRÍTICO**
   - ¿Las APIs de SocialGest, Tikket, Quantico son públicas?
   - ¿Tienen endpoints de métricas/dashboard?
   - ¿Requieren autenticación especial (OAuth, API keys)?
   - ¿Existen rate limits?

2. **Implementación (si se aprueba)**
   - Crear módulo `ProductConnectors` en backend
   - Implementar cifrado AES-256-GCM para credenciales
   - Crear endpoints de gestión de credenciales
   - Implementar conectores específicos por producto
   - Agregar componente `MetricsCard` en frontend
   - Agregar página admin para configurar credenciales

3. **Testing y Seguridad**
   - Auditoría de seguridad del cifrado
   - Validar que credenciales nunca se expongan en logs
   - Testing de conectores con rate limiting
   - Manejo de errores si API de producto no responde

### 📌 Resumen

| Modelo | Descripción | Estado |
|--------|-------------|--------|
| **SSO Puro** | Usuario hace click → redirige al producto con JWT | ✅ Implementado |
| **Aggregator Puro** | Magnetic guarda credenciales → consulta APIs → muestra métricas | ❌ No implementado |
| **Híbrido** | Combina SSO + Aggregator (lo mejor de ambos) | 🟡 Propuesta pendiente de aprobación |

**Este modelo solo debe implementarse después de validar con los Lead Developers de cada producto.**

---

## 🎨 Vistas Frontend (React)

1. **Login Page** (`/login`)
   - Formulario de autenticación
   - Opción "Recordarme"
   - Link a recuperar contraseña

2. **Dashboard** (`/dashboard`)
   - Grid de productos disponibles para el usuario
   - Cada producto muestra: logo, nombre, estado
   - Click → redirección al producto

3. **Profile** (`/profile`)
   - Datos del usuario
   - Cambiar contraseña
   - Sesiones activas

4. **Admin Panel** (`/admin`) - Solo administradores
   - Gestión de usuarios
   - Asignación de productos
   - Logs de acceso

---

## 🛠️ Comandos Útiles

### Backend
```bash
cd magnetic-backend
npm run start:dev      # Desarrollo
npm run build          # Build producción
npm run test           # Tests
npm run migration:run  # Correr migraciones
```

### Frontend
```bash
cd magnetic-frontend
npm run dev            # Desarrollo
npm run build          # Build producción
npm run test           # Tests
```

---

## 📝 Notas Importantes para el Desarrollo

1. **Advocates con subdominios:** Cuando un usuario accede a Advocates, debe redirigirse a su subdominio personalizado (ej: `empresa-x.advocates.com`)

2. **Validación de tokens en productos:** Cada producto existente necesitará un endpoint mínimo para validar tokens de Login Magnetic (esto es lo ÚNICO que se modificaría en los productos)

3. **Seguridad:**
   - Tokens JWT con expiración corta (15 min)
   - Refresh tokens con expiración larga (7 días)
   - Cookies HttpOnly y Secure
   - CORS configurado por producto

4. **Variables de entorno críticas:**
   - `JWT_SECRET` - Secreto para firmar tokens
   - `JWT_REFRESH_SECRET` - Secreto para refresh tokens
   - `DATABASE_URL` - Conexión a PostgreSQL
   - URLs base de cada producto

---

## 🚀 Estado Actual del Proyecto

### Backend (✅ 100% COMPLETO)
- [x] Definición de arquitectura
- [x] Modelo de datos diseñado
- [x] Setup inicial Backend (NestJS)
- [x] Configuración TypeORM + PostgreSQL
- [x] Módulo de autenticación (JWT + Refresh Tokens)
- [x] Módulo de usuarios (CRUD completo)
- [x] Módulo de productos (CRUD + asignación)
- [x] Módulo de sesiones (gestión de sesiones activas)
- [x] Guards y estrategias (JwtAuthGuard, AdminGuard)
- [x] Integración con productos (generación de tokens SSO)
- [x] Seeds automáticos (productos + usuarios demo + usuarios custom)
- [x] Validación de DTOs
- [x] CORS y seguridad configurados
- [x] Scripts de desarrollo y producción
- [x] **🆕 Cambio de contraseña** (POST /auth/change-password)
- [x] **🆕 Gestión de sesiones** (GET /auth/sessions, DELETE)
- [x] **🆕 Cerrar todas las sesiones** (POST /auth/logout-all)
- [x] **🆕 Productos para admin** (GET /products/all)
- [x] **🆕 Actualizar asignaciones** (PATCH /products/assign/:id)
- [x] **🆕 Productos de usuario** (GET /users/:id/products)
- [x] **🆕 Health check** (GET /health)
- [x] **🆕 Recuperación de contraseña** (POST /auth/forgot-password)
- [x] **🆕 Reseteo de contraseña** (POST /auth/reset-password)
- [x] **🆕 Asistente AI** (POST /ai/chat) - ✅ IMPLEMENTADO

**Servidor:** `http://localhost:3000/api`

✅ **Todos los endpoints están implementados y funcionales**

**Nuevos endpoints de recuperación de contraseña:**
- ✅ `POST /auth/forgot-password` - IMPLEMENTADO (loguea token en consola)
- ✅ `POST /auth/reset-password` - IMPLEMENTADO (valida token y actualiza contraseña)
- ⚠️ **Pendiente integración de email**: Actualmente el token se loguea en consola. Para producción se debe integrar:
  - SendGrid
  - AWS SES (Simple Email Service)
  - Resend
  - O cualquier otro servicio SMTP

### Frontend (Completado ✅ 100% MVP)
- [x] Setup inicial Frontend (React + TypeScript + Vite)
- [x] Configuración TailwindCSS
- [x] React Router configurado
- [x] Tipos TypeScript para todas las entidades
- [x] Servicio API con Axios + interceptors
- [x] Store de autenticación (Zustand)
- [x] Sistema de autenticación (login/logout)
- [x] Rutas protegidas (ProtectedRoute)
- [x] **Página de Login** - Con background personalizado + i18n + logo Magnetic
- [x] **Página de Register** - Con validación de contraseñas en tiempo real + i18n
- [x] **Página de ForgotPassword** - Con background personalizado + logo Magnetic
- [x] **Dashboard** - Con productos del usuario + i18n
- [x] **Sistema i18n completo** - Español, Inglés, Portugués
- [x] **Validación de contraseñas** - 5 reglas en tiempo real (8+ chars, especiales, número, mayúscula, coincidencia)
- [x] **Background corporativo** - Imagen de Magnetic en todas las páginas de auth
- [x] **Logo oficial** - SVG de "Powered by Magnetic" en footer
- [x] **Selector de idioma** - Dropdown con banderas en todas las páginas
- [x] Tarjetas de productos con click para SSO
- [x] **Top Banner profesional** - Estilo AdvocatesPro con logos reales de productos
- [x] **Perfil de usuario** - Edición de datos personales (`/profile`)
- [x] **Cambiar contraseña** - Con validación en tiempo real (`/change-password`)
- [x] **Panel de administración** - Layout con sidebar, routing basado en roles
- [x] **Gestión de usuarios (admin)** - CRUD completo con modales
- [x] **Asignación de productos (admin)** - Asignar/quitar productos por usuario
- [x] **Persistencia de sesión** - Fix race condition con isCheckingAuth
- [x] **Productos abren en nueva pestaña** - window.open en vez de location.href
- [x] Asistente AI
- [x] Testing E2E (Playwright - 45+ tests)
- [x] Design System (tokens, colores, iconos, tipografía)
- [ ] Deployment

**Aplicación:** `http://localhost:5173`

#### 🎨 Nuevas Características Frontend

##### Sistema de Internacionalización (i18n)
- **3 idiomas completos**: 🇪🇸 Español (default), 🇺🇸 English, 🇧🇷 Português
- Selector visual con banderas en esquina superior derecha
- Persistencia en localStorage
- Cambio en tiempo real sin recargar
- Estructura: `src/i18n/translations.ts` + `src/i18n/LanguageContext.tsx`

##### Validación de Contraseñas en Registro
- **5 validaciones en tiempo real**:
  1. ✓ Mínimo 8 caracteres
  2. ✓ Caracteres especiales (!@#$%^&*)
  3. ✓ Al menos un número
  4. ✓ Al menos una mayúscula
  5. ✓ Contraseñas coinciden
- Indicadores visuales (✓ verde / ✗ roja)
- Botón deshabilitado hasta cumplir todas
- Checkbox de términos y condiciones obligatorio

##### Assets Corporativos
- **Background**: `src/assets/images/magnetic-background.webp` (imagen de oficina Magnetic)
- **Logo**: `src/assets/images/powered-by-magnetic-logo.svg` (logo oficial)
- Overlay oscuro para mejor legibilidad
- Responsive: solo visible en pantallas grandes

---

## 🎯 Inicio Rápido

### Backend está 100% listo y funcional

```bash
# 1. Base de datos PostgreSQL
docker run --name magnetic-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=magnetic_db \
  -p 5432:5432 -d postgres

# 2. Configurar variables
cp .env.example .env

# 3. Levantar servidor
npm run start:dev

# 4. Setup automático (crea productos + usuarios demo)
npm run seed:demo
```

**Usuarios de prueba disponibles:**
```bash
# Crear usuarios demo (admin + demo con 4 productos)
npm run seed:demo

# Crear usuarios personalizados (0, 1, 2, 3 productos)
npm run seed:custom
```

**Credenciales:**
- Admin: `admin@magnetic.com` / `Admin123!` (sin productos, solo gestión)
- Demo: `demo@magnetic.com` / `Demo123!` (4 productos: SocialGest, Tikket, Advocates, Quantico)
- User1: `user1@magnetic.com` / `User123!` (0 productos)
- User2: `user2@magnetic.com` / `User123!` (1 producto: SocialGest)
- User3: `user3@magnetic.com` / `User123!` (2 productos: SocialGest, Tikket)
- User4: `user4@magnetic.com` / `User123!` (3 productos: SocialGest, Tikket, Advocates)

**Servidor corriendo en:** `http://localhost:3000/api`

Ver [INICIO-RAPIDO.md](INICIO-RAPIDO.md) para más detalles.

---

## 📁 Estructura de Archivos

### Backend (magnetic-backend)
```
src/
├── main.ts
├── app.module.ts
├── config/
│   └── configuration.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   ├── products/
│   │   ├── products.module.ts
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   └── entities/
│   │       ├── product.entity.ts
│   │       └── user-product.entity.ts
│   └── sessions/
│       ├── sessions.module.ts
│       ├── sessions.service.ts
│       └── entities/
│           └── session.entity.ts
└── common/
    ├── decorators/
    ├── filters/
    ├── interceptors/
    └── pipes/
```

### Frontend (magnetic-frontend) 🔄 PENDIENTE
```
magnetic-frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── assets/
│   ├── components/
│   │   ├── ui/                           # Componentes reutilizables
│   │   ├── layout/                       # Layout (Header, Sidebar, etc.)
│   │   └── auth/                         # Componentes de autenticación
│   ├── pages/
│   │   ├── Login.tsx                     # Página de login
│   │   ├── Dashboard.tsx                 # Dashboard con productos
│   │   ├── Profile.tsx                   # Perfil de usuario
│   │   └── admin/                        # Panel admin
│   │       ├── Users.tsx                 # Gestión de usuarios
│   │       └── AssignProducts.tsx        # Asignar productos
│   ├── hooks/
│   │   └── useAuth.ts                    # Hook de autenticación
│   ├── services/
│   │   └── api.ts                        # Cliente Axios/Fetch
│   ├── store/
│   │   └── authStore.ts                  # Estado global (Zustand/Redux)
│   ├── types/
│   │   └── index.ts                      # TypeScript types
│   └── utils/
│       └── helpers.ts                    # Funciones auxiliares
├── .env.example
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**El frontend debe consumir el API del backend que ya está funcionando.**

---

## 🔄 Integración Frontend - Backend

### API Base URL
```typescript
const API_BASE_URL = 'http://localhost:3000/api';
```

### Flujo de Autenticación en Frontend

1. **Login**
```typescript
POST /api/auth/login
Body: { email, password }
Response: { user, accessToken, refreshToken }

// Guardar tokens en localStorage o estado
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);
```

2. **Requests Autenticados**
```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`
}
```

3. **Refresh Token (cuando el accessToken expira)**
```typescript
POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken, refreshToken }
```

4. **Obtener Usuario Actual**
```typescript
GET /api/auth/me
Headers: { Authorization: Bearer token }
Response: { id, email, firstName, lastName, isAdmin, ... }
```

### Dashboard - Mostrar Productos del Usuario

```typescript
GET /api/products
Headers: { Authorization: Bearer token }
Response: [
  {
    id: "uuid",
    product: {
      name: "Quantico",
      slug: "quantico",
      baseUrl: "https://quantico.com",
      logoUrl: "...",
      description: "Analytics y métricas"
    },
    externalUserId: "santiago-quantico-123",
    customDomain: null
  },
  // ... más productos
]
```

### Acceder a un Producto (Redirección SSO)

```typescript
GET /api/products/{slug}/access
Headers: { Authorization: Bearer token }
Response: {
  accessToken: "JWT_TOKEN_SSO",
  redirectUrl: "https://quantico.com/auth/sso?token=JWT_TOKEN_SSO"
}

// Hacer redirección
window.location.href = response.redirectUrl;
```

### Panel de Admin - Asignar Productos

```typescript
POST /api/products/assign/{userId}
Headers: { Authorization: Bearer adminToken }
Body: {
  productId: "product-uuid",
  externalUserId: "santiago-quantico-123",
  customDomain: "adpro.advocates.com",  // Solo para Advocates
  metadata: { role: "admin" }            // Opcional
}
```

### Tipos TypeScript Recomendados

```typescript
// types/index.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
}

export interface UserProduct {
  id: string;
  userId: string;
  productId: string;
  externalUserId: string;
  customDomain?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  product: Product;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SSOAccessResponse {
  accessToken: string;
  redirectUrl: string;
}
```

---

## 🎨 Diseño UI/UX - Recomendaciones Frontend

### Página de Login
- Formulario simple: email + password
- Botón "Recordarme"
- Link "¿Olvidaste tu contraseña?"
- Mensaje de error claro

### Dashboard de Productos
- Grid de tarjetas con los productos
- Cada tarjeta muestra:
  - Logo del producto
  - Nombre del producto
  - Descripción breve
  - Botón "Acceder"
- Al hacer click en "Acceder" → redirige con token SSO

### Panel de Administración
- Tabla de usuarios con acciones (editar, eliminar)
- Botón "Crear nuevo usuario"
- Modal para asignar productos:
  - Select de usuario
  - Select de producto
  - Input: ID del usuario en el producto externo
  - Input: Subdominio (solo visible si producto es Advocates)
  - Textarea: Metadata JSON (opcional)

### Header
- Logo de Login Magnetic
- Nombre del usuario actual
- Avatar (si existe)
- Dropdown:
  - Mi perfil
  - Configuración
  - Cerrar sesión

---

## 🔐 Seguridad Frontend

1. **Guardar tokens de forma segura**
   - Usar `localStorage` o `sessionStorage`
   - Nunca exponer tokens en URLs
   - Limpiar tokens al cerrar sesión

2. **Manejo de expiración de tokens**
   - Interceptor de Axios para refresh automático
   - Redirigir a login si refresh falla

3. **Validación de permisos**
   - Mostrar/ocultar opciones de admin según `user.isAdmin`
   - Proteger rutas con guards

4. **HTTPS en producción**
   - Siempre usar HTTPS
   - Configurar CORS correctamente

---

## 🚀 Deploy en AWS

### Backend (Opción Recomendada: ECS + Fargate)

1. **Crear Dockerfile**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/main"]
```

2. **RDS PostgreSQL**
   - Crear instancia RDS PostgreSQL
   - Guardar endpoint en variables de entorno

3. **ECS Task Definition**
   - Definir contenedor con imagen Docker
   - Variables de entorno desde Secrets Manager

4. **Application Load Balancer**
   - Health check en `/api/auth/me` (requiere auth, cambiar a health endpoint)
   - SSL/TLS certificate

### Frontend (Opción: S3 + CloudFront)

1. **Build de producción**
```bash
npm run build
```

2. **S3 Bucket**
   - Subir archivos del build
   - Configurar como static website

3. **CloudFront**
   - Distribución CDN
   - Certificado SSL
   - Configurar dominio personalizado

---

## 📞 Contacto y Siguiente Fase

**Backend completado:** ✅ 100%
**Frontend pendiente:** 🔄 0%

El backend está listo para ser consumido por el frontend. Todos los endpoints están documentados y funcionando.

**Próximo paso:** Crear el proyecto de frontend en React + TypeScript.


---

## 🔄 Integración Frontend - Backend

### API Base URL
```typescript
const API_BASE_URL = 'http://localhost:3000/api';
```

### Flujo de Autenticación en Frontend

1. **Login**
```typescript
POST /api/auth/login
Body: { email, password }
Response: { user, accessToken, refreshToken }

// Guardar tokens en localStorage
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);
```

2. **Requests Autenticados**
```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`
}
```

3. **Dashboard - Mostrar Productos del Usuario**
```typescript
GET /api/products
Headers: { Authorization: Bearer token }
Response: [
  {
    product: {
      name: "Quantico",
      slug: "quantico",
      baseUrl: "https://quantico.com",
      logoUrl: "..."
    },
    externalUserId: "santiago-quantico-123",
    customDomain: null
  }
]
```

4. **Acceder a un Producto (SSO)**
```typescript
GET /api/products/{slug}/access
Response: {
  accessToken: "JWT_TOKEN_SSO",
  redirectUrl: "https://quantico.com/auth/sso?token=JWT"
}

// Redirigir
window.location.href = response.redirectUrl;
```

### Tipos TypeScript Recomendados

```typescript
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  logoUrl?: string;
  description?: string;
}

export interface UserProduct {
  id: string;
  externalUserId: string;
  customDomain?: string;
  product: Product;
}
```

---

## 🚀 Deploy en AWS

### Backend: ECS + Fargate + RDS

1. **RDS PostgreSQL**
   - Crear instancia RDS
   - Guardar endpoint en variables de entorno

2. **Docker Image**
   - Crear Dockerfile
   - Push a ECR (Elastic Container Registry)

3. **ECS Service**
   - Task Definition con variables de entorno
   - Application Load Balancer
   - SSL/TLS certificate

### Frontend: S3 + CloudFront

1. Build de producción → S3 Bucket
2. CloudFront distribution
3. Dominio personalizado con Route 53

---

## 📞 Estado Actual

**Backend:** ✅ 100% completado y funcional
**Frontend:** 🔄 Pendiente

Todos los endpoints están documentados y probados.
El backend está listo para ser consumido por el frontend.

**Siguiente paso:** Crear proyecto React + TypeScript.


---

## 🖥️ Cómo Levantar el Proyecto Completo

### 1. Backend

```bash
cd magnetic-backend

# Asegurar que PostgreSQL esté corriendo
# Ver base de datos en pgAdmin: magnetic_db

# Levantar servidor
npm run start:dev

# Si es primera vez, ejecutar seeds
npm run seed:demo
```

**Servidor corriendo en:** `http://localhost:3000/api`

### 2. Frontend

```bash
cd magnetic-frontend

# Levantar aplicación
npm run dev
```

**Aplicación corriendo en:** `http://localhost:5173`

### 3. Probar la Aplicación

1. Abrir navegador en `http://localhost:5173`
2. Te redirige a `/login`
3. Usar credenciales demo:
   - Email: `demo@magnetic.com`
   - Password: `Demo123!`
   - O hacer click en "Login Demo"
4. Verás el Dashboard con 4 productos
5. Click en cualquier producto para generar token SSO

---

## 📁 Estructura Actualizada del Frontend

```
magnetic-frontend/
├── public/
│   └── favicon.svg                            # ✅ Favicon Magnetic oficial
├── src/
│   ├── assets/
│   │   └── images/
│   │       ├── magnetic-background.webp       # ✅ Background corporativo
│   │       ├── powered-by-magnetic-logo.svg   # ✅ Logo oficial
│   │       ├── Isologo-Black.png              # ✅ Logo Magnetic (TopBanner)
│   │       ├── Favicon Magnetic (1).svg       # ✅ Favicon original
│   │       ├── SocialGest-Isotipo-Blue.png    # ✅ Isotipo SocialGest
│   │       ├── SocialGest-Imagotipo-Blue.png  # ✅ Imagotipo SocialGest
│   │       ├── Tikket-Isotipo-Blue.png        # ✅ Isotipo Tikket
│   │       ├── Tikket-Imagotipo-Blue.png      # ✅ Imagotipo Tikket
│   │       ├── Advocates-Isotipo-Blue.png     # ✅ Isotipo Advocates
│   │       ├── Advocates-Imagotipo-Blue.png   # ✅ Imagotipo Advocates
│   │       ├── Quantico-Isotipo-Blue.png      # ✅ Isotipo Quantico
│   │       └── Quantico-Imagotipo-Blue.png    # ✅ Imagotipo Quantico
│   ├── components/
│   │   ├── ai/
│   │   │   ├── AIButton.tsx                   # ✅ Botón flotante AI (legacy)
│   │   │   └── ChatDrawer.tsx                 # ✅ Chat drawer lateral con historial
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx             # ✅ Rutas protegidas
│   │   │   └── AdminRoute.tsx                 # ✅ Guard admin (isAdmin)
│   │   ├── dashboard/
│   │   │   └── ConnectProductModal.tsx        # ✅ Modal conexión producto
│   │   ├── help/
│   │   │   └── FAQDrawer.tsx                  # ✅ Drawer FAQ con búsqueda y acordeón
│   │   ├── layout/
│   │   │   ├── TopBanner.tsx                  # ✅ Banner superior + AI + Help
│   │   │   └── AdminLayout.tsx                # ✅ Layout admin con sidebar + AI + FAQ
│   │   └── ui/
│   │       ├── LanguageSelector.tsx           # ✅ Selector de idioma
│   │       └── Skeleton.tsx                   # ✅ Skeleton loaders
│   ├── i18n/
│   │   ├── translations.ts                    # ✅ Traducciones ES/EN/PT (todas las páginas)
│   │   └── LanguageContext.tsx                # ✅ Contexto de idioma
│   ├── pages/
│   │   ├── Login.tsx                          # ✅ Login + i18n + background
│   │   ├── Register.tsx                       # ✅ Registro + validaciones + i18n
│   │   ├── ForgotPassword.tsx                 # ✅ Recuperar contraseña + i18n
│   │   ├── Dashboard.tsx                      # ✅ Dashboard + cards con estados de conexión
│   │   ├── ProductMetrics.tsx                 # ✅ Página métricas por producto (stat cards)
│   │   ├── Profile.tsx                        # ✅ Perfil de usuario + i18n
│   │   ├── ChangePassword.tsx                 # ✅ Cambiar contraseña + i18n
│   │   └── admin/
│   │       ├── AdminDashboard.tsx             # ✅ Stats overview admin
│   │       ├── Users.tsx                      # ✅ CRUD usuarios
│   │       └── AssignProducts.tsx             # ✅ Asignar productos + badge conexión
│   ├── services/
│   │   └── api.ts                             # ✅ Cliente API + interceptors
│   ├── store/
│   │   └── authStore.ts                       # ✅ Estado global (Zustand)
│   ├── types/
│   │   └── index.ts                           # ✅ TypeScript interfaces
│   ├── App.tsx                                # ✅ Rutas + LanguageProvider
│   ├── main.tsx                               # ✅ Punto de entrada
│   └── index.css                              # ✅ Tailwind CSS
├── index.html                                 # ✅ Título "Magnetic Suite" + favicon.svg
├── .env                                       # ✅ Variables de entorno
├── tailwind.config.js                         # ✅ Configuración Tailwind
├── package.json                               # ✅ Dependencias
└── CLAUDE.md                                  # ✅ Documentación completa
```

---

## 🎨 Personalización del Login

El login tiene un background temporal (gradiente). Para cambiarlo por una imagen:

**Archivo:** `src/pages/Login.tsx` (línea 17)

```tsx
// Actual (gradiente temporal)
<div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 -z-10"></div>

// Cambiar por imagen
<div className="absolute inset-0 -z-10">
  <img src="/background.jpg" className="w-full h-full object-cover" />
</div>
```

Colocar la imagen en: `magnetic-frontend/public/background.jpg`

---

## 🔄 Flujo Completo de Autenticación

### Frontend → Backend

1. **Usuario ingresa credenciales** en `/login`
2. **Frontend** llama a `POST /api/auth/login`
3. **Backend** valida credenciales y retorna:
   ```json
   {
     "user": { ... },
     "accessToken": "jwt...",
     "refreshToken": "jwt..."
   }
   ```
4. **Frontend** guarda tokens en `localStorage`
5. **Frontend** redirige a `/dashboard`
6. **Dashboard** carga productos: `GET /api/products`
7. **Usuario** hace click en producto
8. **Frontend** llama a `GET /api/products/:slug/access`
9. **Backend** genera token SSO y retorna URL
10. **Frontend** redirige a la URL del producto con token

---

## 🔐 Usuarios de Prueba

### Usuario Demo (tiene 4 productos)
- Email: `demo@magnetic.com`
- Password: `Demo123!`
- Productos: SocialGest, Tikket, Advocates, Quantico

### Usuario Admin (puede gestionar usuarios)
- Email: `admin@magnetic.com`
- Password: `Admin123!`
- Permisos: Crear/editar/eliminar usuarios, asignar productos

---

## ⚙️ Configuración de Variables de Entorno

### Backend (.env)
```env
PORT=3000
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=magnetic_db

JWT_SECRET=mi-super-secret-key-2024
JWT_REFRESH_SECRET=mi-refresh-secret-key-2024
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173

SOCIALGEST_URL=https://socialgest.com
TIKKET_URL=https://tikket.com
ADVOCATES_URL=https://advocates.com
QUANTICO_URL=https://quantico.com
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

---

## 📊 Estado de Desarrollo

| Componente | Estado | Progreso |
|------------|--------|----------|
| Backend API (Login + SSO + Sesiones) | ✅ Completo | 100% |
| Backend Auth (Cambio de Contraseña) | ✅ Completo | 100% |
| Backend Users (CRUD + Products) | ✅ Completo | 100% |
| Backend Products (CRUD + Asignación) | ✅ Completo | 100% |
| Backend Health Check | ✅ Completo | 100% |
| Base de Datos | ✅ Completo | 100% |
| Frontend Base | ✅ Completo | 100% |
| Sistema i18n (ES/EN/PT) - Todas las páginas | ✅ Completo | 100% |
| Validación de Contraseñas | ✅ Completo | 100% |
| Login/Register UI | ✅ Completo | 100% |
| Background + Logo Corporativo | ✅ Completo | 100% |
| Dashboard + Top Banner | ✅ Completo | 100% |
| Dashboard Cards con Preview | ✅ Completo | 100% |
| Sección "Agregar Productos" | ✅ Completo | 100% |
| Perfil de Usuario | ✅ Completo (frontend) | 100% |
| Cambiar Contraseña | ✅ Completo (frontend) | 100% |
| Admin Panel (Frontend) | ✅ Completo | 100% |
| Admin - Role-Based Routing | ✅ Completo | 100% |
| Admin - Gestión de Usuarios (CRUD) | ✅ Completo | 100% |
| Admin - Asignación de Productos | ✅ Completo | 100% |
| Persistencia de Sesión (isCheckingAuth) | ✅ Completo | 100% |
| Productos abren en nueva pestaña | ✅ Completo | 100% |
| Asistente AI (Frontend) | ✅ Completo | 100% |
| FAQ Drawer (Frontend) | ✅ Completo | 100% |
| Mejoras UX (Toasts + Skeleton) | ✅ Completo | 100% |
| Conexión de Productos (Frontend) | ✅ Completo | 100% |
| Formulario de conexión por producto | ✅ Completo | 100% |
| Dashboard de métricas (Frontend) | ✅ Completo | 100% |
| Admin - Ver estado conexión productos | ✅ Completo | 100% |
| Integración SSO | ✅ Funcional | 100% |
| Backend - Cifrado AES-256-GCM | ✅ Completo | 100% |
| Backend - Endpoints conexión/desconexión | ✅ Completo | 100% |
| Backend - Conector AdvocatesPro | ✅ Completo | 100% |
| Backend - Dashboard métricas API | ✅ Completo | 100% |
| Backend - Credenciales Admin API | ✅ Completo | 100% |
| Design System (tokens, colores, iconos) | ✅ Completo | 100% |
| E2E Testing - Playwright | ✅ Completo | 100% |
| E2E - Auth (login, register, forgot) | ✅ 8 tests | 100% |
| E2E - Dashboard (productos, AI, FAQ) | ✅ 7 tests | 100% |
| E2E - Connect Product & Métricas | ✅ 5 tests | 100% |
| E2E - Admin Panel (CRUD, acceso) | ✅ 8 tests | 100% |
| E2E - Profile & Change Password | ✅ 8 tests | 100% |
| E2E - Forgot Password & Register | ✅ 9 tests | 100% |

**MVP Funcional:** ✅ **LISTO PARA USAR** (con limitaciones de registro backend)


---

## 🌍 Sistema de Internacionalización (i18n)

### Idiomas Disponibles
- 🇪🇸 **Español** (por defecto)
- 🇺🇸 **Inglés** (English)
- 🇧🇷 **Portugués** (Português)

### Cómo Usar

#### Cambiar Idioma
1. Click en el selector en la esquina superior derecha
2. Selecciona el idioma deseado
3. El cambio es instantáneo y se guarda en localStorage

#### Agregar Nuevas Traducciones
Editar el archivo: `src/i18n/translations.ts`

```typescript
export const translations: Record<Language, Translations> = {
  es: {
    common: {
      newKey: 'Nuevo texto en español',
    },
  },
  en: {
    common: {
      newKey: 'New text in English',
    },
  },
  pt: {
    common: {
      newKey: 'Novo texto em Português',
    },
  },
};
```

#### Usar Traducciones en Componentes
```typescript
import { useTranslation } from '../i18n/LanguageContext';

function MyComponent() {
  const t = useTranslation();
  
  return (
    <div>
      <h1>{t.common.newKey}</h1>
      <button>{t.auth.login}</button>
    </div>
  );
}
```

---

## 🔐 Validación de Contraseñas

### Reglas Implementadas

La página de registro valida en tiempo real:

1. **Longitud Mínima**: La contraseña debe tener al menos 8 caracteres
2. **Caracteres Especiales**: Debe incluir al menos uno: `!@#$%^&*(),.?":{}|<>`
3. **Número**: Debe incluir al menos un dígito (0-9)
4. **Mayúscula**: Debe incluir al menos una letra mayúscula (A-Z)
5. **Coincidencia**: Ambas contraseñas deben ser idénticas

### Indicadores Visuales

- ✅ **Verde con checkmark** - Regla cumplida
- ❌ **Roja con X** - Regla no cumplida
- **Botón deshabilitado** - Hasta que todas las reglas se cumplan
- **Checkbox de términos** - Obligatorio para habilitar el registro

### Personalizar Validaciones

Editar el archivo: `src/pages/Register.tsx` (líneas 39-46)

```typescript
useEffect(() => {
  setValidation({
    minLength: password.length >= 8,  // Cambiar el número mínimo aquí
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),  // Regex personalizado
    hasNumber: /\d/.test(password),
    hasUpperCase: /[A-Z]/.test(password),
    passwordsMatch: password === confirmPassword && password !== '' && confirmPassword !== '',
  });
}, [password, confirmPassword]);
```

---

## 🎨 Assets Corporativos

### Background Image
**Ubicación:** `src/assets/images/magnetic-background.webp`
- Imagen de la oficina Magnetic con la letra "M"
- Usada en: Login, Register, ForgotPassword, Success screen
- Overlay oscuro aplicado para mejor legibilidad
- Responsive: solo visible en pantallas lg+ (1024px+)

**Para cambiar:**
1. Reemplaza el archivo `magnetic-background.webp` con tu nueva imagen
2. Mantén el mismo nombre de archivo
3. El cambio se aplica automáticamente (Hot Module Replacement)

### Logo Oficial
**Ubicación:** `src/assets/images/powered-by-magnetic-logo.svg`
- Logo vectorial "Powered by Magnetic"
- Usada en el footer de todas las páginas de auth
- Altura fija: 32px (h-8 en Tailwind)

**Para cambiar:**
1. Reemplaza el archivo `powered-by-magnetic-logo.svg`
2. O edita las páginas para cambiar `className="h-8"` al tamaño deseado

---

## 🚧 Pendientes Backend

### Endpoints que Faltan Implementar

El frontend está completamente funcional, pero el backend necesita implementar:

#### 1. Registro de Usuarios
```typescript
POST /api/auth/register
Body: {
  email: string,
  firstName: string,
  lastName: string,
  password: string
}
Response: {
  user: User
}
```

**Estado Actual:** ❌ No implementado
**Frontend:** ✅ Preparado en `src/pages/Register.tsx`

#### 2. Solicitud de Recuperación de Contraseña
```typescript
POST /api/auth/forgot-password
Body: {
  email: string
}
Response: {
  message: string
}
```

**Estado Actual:** ❌ No implementado
**Frontend:** ✅ Preparado en `src/pages/ForgotPassword.tsx`

#### 3. Reset de Contraseña
```typescript
POST /api/auth/reset-password
Body: {
  token: string,
  newPassword: string
}
Response: {
  message: string
}
```

**Estado Actual:** ❌ No implementado
**Frontend:** ⏳ Por implementar página

#### 4. Cambio de Contraseña (usuario autenticado)
```typescript
PATCH /api/auth/change-password
Headers: { Authorization: Bearer token }
Body: {
  currentPassword: string,
  newPassword: string
}
Response: {
  message: string
}
```

**Estado Actual:** ❌ No implementado
**Frontend:** ✅ Preparado en `src/pages/ChangePassword.tsx`

#### 5. Actualización de Perfil de Usuario
```typescript
PATCH /api/users/:id
Headers: { Authorization: Bearer token }
Body: {
  firstName?: string,
  lastName?: string
}
Response: {
  user: User
}
```

**Estado Actual:** ❌ No implementado (el endpoint existe pero no está probado con estos campos)
**Frontend:** ✅ Preparado en `src/pages/Profile.tsx`

### Solución Temporal

Mientras se implementan estos endpoints, los usuarios deben ser creados manualmente:

1. Por el administrador desde el panel admin (cuando esté implementado)
2. O ejecutando seeds/scripts en el backend
3. O creándolos directamente en la base de datos PostgreSQL

---

## 📝 Próximos Pasos Recomendados

### Prioridad Alta
1. **Implementar endpoints de auth en backend**
   - `POST /auth/register` - Registro de nuevos usuarios
   - `POST /auth/forgot-password` - Solicitud de recuperación de contraseña
   - `POST /auth/reset-password` - Reseteo de contraseña con token

2. **Integración SSO con productos externos**
   - Cada producto necesita un endpoint `GET /auth/sso?token=xxx` para validar el JWT
   - Se usa un `JWT_SECRET` global compartido entre Magnetic y todos los productos
   - El token SSO contiene `externalUserId` (el ID del usuario en el producto destino)
   - Ver sección "Flujo SSO Detallado" más abajo

3. **Asistente AI (ver sección dedicada abajo)**
   - Backend: Módulo AI con proxy a OpenAI
   - Frontend: Botón flotante + chat drawer

### Prioridad Media
4. **Testing** ✅ COMPLETADO
   - Tests E2E con Playwright (45+ tests cubriendo auth, dashboard, admin, profile, connect product, forgot password, register)
   - Tests unitarios pendientes (Jest + React Testing Library)

5. **Logs de actividad en Admin Panel**
   - Registro de accesos SSO por usuario/producto
   - Historial de cambios de admin (crear/editar/eliminar usuarios)

### Prioridad Baja
6. **Mejoras UI/UX**
   - Animaciones y transiciones
   - Skeleton loaders
   - Toasts/Notificaciones

7. **Deploy a Producción**
   - Frontend → Vercel/Netlify
   - Backend → AWS ECS/Fargate
   - Base de datos → AWS RDS

---

## 🌐 Cobertura i18n Completa del Frontend

Todas las páginas y componentes del frontend usan el sistema de internacionalización. **No hay strings hardcodeados en español.** El backend debe tener en cuenta que los mensajes de error devueltos en las respuestas API serán mostrados directamente al usuario, por lo que idealmente deberían ser códigos de error que el frontend pueda mapear a traducciones, o bien el backend debería soportar un header `Accept-Language`.

### Secciones de Traducción en `src/i18n/translations.ts`

| Sección | Claves | Páginas/Componentes que la usan |
|---------|--------|---------------------------------|
| `common` | 10 | Compartido (cancel, save, loading, etc.) |
| `auth` | 21 | Login.tsx, Register.tsx |
| `register` | 17 | Register.tsx |
| `forgotPassword` | 9 | ForgotPassword.tsx |
| `dashboard` | 7 | Dashboard.tsx |
| `dashboardExtra` | 23 | Dashboard.tsx, TopBanner.tsx |
| `profile` | 22 | Profile.tsx |
| `changePassword` | 18 | ChangePassword.tsx |
| `admin` | ~45 | AdminDashboard, Users, AssignProducts, AdminLayout |
| `language` | 4 | LanguageSelector.tsx |

### Consideraciones para el Backend

1. **Mensajes de error de API**: El frontend usa `err.response?.data?.message` como fallback. Si el backend devuelve mensajes en español, no se traducirán automáticamente. Se recomienda:
   - Devolver códigos de error (`INVALID_CURRENT_PASSWORD`, `USER_NOT_FOUND`) en vez de mensajes legibles
   - O que el frontend mapee los códigos a `t.changePassword.errorMessage`, etc.

2. **Formato de fechas**: El frontend usa `toLocaleDateString()` con locale basado en el idioma seleccionado (`es-ES`, `en-US`, `pt-BR`). No se requiere que el backend formatee fechas.

3. **Validaciones**: Las reglas de validación de contraseña (8+ chars, especial, número, mayúscula) están implementadas en el frontend. El backend debe aplicar las **mismas reglas** para consistencia:
   - Mínimo 8 caracteres
   - Al menos un carácter especial (`!@#$%^&*(),.?":{}|<>`)
   - Al menos un número
   - Al menos una mayúscula

---

## 🤖 Asistente AI - ✅ IMPLEMENTADO

### Objetivo
Asistente de inteligencia artificial integrado al Dashboard que responde preguntas sobre los productos de Magnetic Suite. El asistente se conecta a la API de OpenAI (Platform) y su contexto se configura dinámicamente según los productos asignados al usuario.

**Estado:** ✅ **Backend 100% implementado** | ⏳ Frontend pendiente

### Arquitectura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Frontend   │────▶│  Backend         │────▶│  OpenAI API │
│  Chat UI    │     │  POST /api/ai/chat│     │  (gpt-4o-mini)│
│  (JWT Auth) │◀────│  (proxy seguro)  │◀────│             │
└─────────────┘     └──────────────────┘     └─────────────┘
```

**El backend es OBLIGATORIO** para este feature:
- La API key de OpenAI NO puede estar en el frontend (riesgo de seguridad)
- El backend actúa como proxy seguro, autenticado con JWT
- El system prompt se construye dinámicamente con los productos del usuario

### Backend - Endpoint ✅ Implementado

#### `POST /api/ai/chat`
```typescript
// Headers: { Authorization: Bearer <jwt> }
// Body:
{
  message: string,              // Mensaje del usuario
  history?: {                   // Historial de conversación (últimos N mensajes)
    role: 'user' | 'assistant',
    content: string
  }[]
}

// Response:
{
  reply: string,                // Respuesta del asistente
  usage?: {                     // Opcional: métricas de uso
    promptTokens: number,
    completionTokens: number,
    totalTokens: number
  }
}
```

### Backend - Lógica Implementada ✅

El endpoint está completamente funcional con la siguiente lógica:

1. **Autenticar** al usuario con JWT (JwtAuthGuard) ✅
2. **Obtener productos** del usuario desde la base de datos ✅
3. **Construir system prompt** dinámico ✅

```typescript
const systemPrompt = `Eres el asistente virtual de Magnetic Suite.
Tu nombre es Magnetic AI.

El usuario ${user.firstName} ${user.lastName} tiene acceso a los siguientes productos:
${userProducts.map(p => `- ${p.product.name}: ${p.product.description}`).join('\n')}

Reglas:
- Solo responde preguntas relacionadas con los productos listados arriba
- Si preguntan por un producto que el usuario NO tiene, indica que no tiene acceso y sugiere contactar al administrador
- Responde en el mismo idioma en que te escriban
- Sé conciso y útil
- No inventes funcionalidades que no existen

Información de los productos:
- SocialGest (socialgest.net): Gestión integral de redes sociales. Programación de posts, analytics, gestión de comunidad.
- Tikket (tikket.net): Sistema de tickets y soporte al cliente. Gestión de conversaciones, asignación de agentes, reportes.
- AdvocatesPro (magneticsuite.com/advocatespro): Plataforma de employee advocacy. Amplificación de marca a través de colaboradores.
- Quantico (quantico.ai): Analytics y métricas avanzadas. Dashboards, reportes automatizados, insights de datos.`;
```

4. **Llamar a OpenAI API**:
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',        // Económico y suficiente para Q&A
  messages: [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ],
  max_tokens: 500,              // Limitar costo por respuesta
  temperature: 0.7,
});
```

5. **Retornar respuesta** al frontend

### Backend - Variables de Entorno ✅ Configuradas

```env
# ✅ Ya configuradas en .env
OPENAI_API_KEY=sk-proj-...      # API key de OpenAI Platform
OPENAI_MODEL=gpt-4o-mini        # Modelo a usar (default: gpt-4o-mini)
OPENAI_MAX_TOKENS=500            # Máximo de tokens por respuesta
```

**Nota:** Rate limit de 20 mensajes/hora está implementado en memoria (puede escalarse a Redis).

### Backend - Dependencia ✅ Instalada

```bash
npm install openai  # ✅ Ya instalado
```

### Backend - Módulo NestJS ✅ Implementado

```
src/modules/ai/
├── ai.module.ts          # ✅ Módulo configurado
├── ai.controller.ts      # ✅ Endpoint POST /chat
├── ai.service.ts         # ✅ Lógica + OpenAI integration + Rate limiting
└── dto/
    └── chat.dto.ts       # ✅ Validación de requests
```

**Registrado en:** `src/app.module.ts` ✅

### Backend - Rate Limiting ✅ Implementado

Límite de mensajes por usuario para controlar costos:
- **20 mensajes por hora** por usuario ✅
- Contador almacenado en memoria (puede escalarse a Redis)
- Retorna error 429 si se excede el límite ✅

```typescript
// Response 429:
{
  statusCode: 429,
  message: 'AI_RATE_LIMIT_EXCEEDED',  // Código para que el frontend traduzca
  retryAfter: 3600                     // Segundos hasta reset
}
```

### Backend - Pruebas Realizadas ✅

**Test 1: Usuario con 4 productos (demo@magnetic.com)**
- ✅ Lista correctamente los 4 productos asignados
- ✅ Responde en español automáticamente
- ✅ Proporciona información relevante sobre cada producto

**Test 2: Usuario con 1 producto (user2@magnetic.com)**
- ✅ Detecta que el usuario solo tiene SocialGest
- ✅ Rechaza preguntas sobre productos no asignados (Quantico)
- ✅ Sugiere contactar al administrador
- ✅ Ofrece ayuda con productos disponibles

**Test 3: Multiidioma**
- ✅ Detecta y responde en el idioma de la pregunta
- ✅ Soporta español, inglés y portugués

**Test 4: Rate Limiting**
- ✅ Contador funcional por usuario
- ✅ Permite hasta 20 mensajes por hora
- ⏳ Retorna error 429 después del límite (probado en código)

**Costos reales observados:**
- Mensaje promedio: ~320-350 tokens
- Costo por mensaje: ~$0.0002
- Tiempo de respuesta: 1-3 segundos

---

### Frontend - Componentes (por implementar)

1. **Botón flotante AI** - Esquina inferior derecha del Dashboard
   - Icono de AI/sparkles
   - Badge con indicador de disponibilidad

2. **Chat Drawer/Modal** - Se abre al hacer click en el botón
   - Header con título "Magnetic AI"
   - Lista de mensajes (usuario + asistente)
   - Input de texto + botón enviar
   - Indicador de "escribiendo..."
   - Historial se mantiene en estado local (no persiste entre sesiones)

3. **Traducciones i18n** necesarias:
   - `ai.title`: "Magnetic AI" / "Magnetic AI" / "Magnetic AI"
   - `ai.placeholder`: "Escribe tu pregunta..." / "Type your question..." / "Digite sua pergunta..."
   - `ai.send`: "Enviar" / "Send" / "Enviar"
   - `ai.thinking`: "Pensando..." / "Thinking..." / "Pensando..."
   - `ai.rateLimitError`: "Has alcanzado el límite..." / "You've reached the limit..." / "Você atingiu o limite..."
   - `ai.errorMessage`: "Error al procesar tu mensaje" / "Error processing your message" / "Erro ao processar sua mensagem"
   - `ai.welcome`: "Hola! Soy Magnetic AI..." / "Hi! I'm Magnetic AI..." / "Olá! Sou Magnetic AI..."

### Costos Estimados (OpenAI gpt-4o-mini)

| Concepto | Costo |
|----------|-------|
| Input | ~$0.15 / 1M tokens |
| Output | ~$0.60 / 1M tokens |
| Mensaje promedio (~300 tokens total) | ~$0.0002 |
| 1000 mensajes/día | ~$0.20/día |
| 30,000 mensajes/mes | ~$6/mes |

---

## 📋 Dashboard - Características Actuales

### Sección "Mis Productos"
- Cards con imagen preview del producto (header h-36)
- Imagotipo del producto debajo del preview
- Descripción del producto (i18n)
- Indicador verde de estado activo (animado)
- Botón "Acceder" → redirección SSO con token JWT
- Soporte para custom domain (badge púrpura para Advocates)

### Sección "Agregar Productos"
- Se muestra solo para productos que el usuario **NO tiene** asignados
- Si tiene todos los productos, esta sección no aparece
- Si no tiene ninguno, solo se muestra esta sección (sin "Mis Productos")
- Cards con preview del sitio web del producto
- Imagotipo + descripción + botón "Visitar sitio" (abre en nueva pestaña)

### URLs de productos
| Producto | URL |
|----------|-----|
| SocialGest | https://socialgest.net/es |
| Tikket | https://www.tikket.net/es |
| AdvocatesPro | https://magneticsuite.com/advocatespro |
| Quantico | https://quantico.ai/ |

### Preview Images de productos
| Producto | URL del preview |
|----------|----------------|
| SocialGest | https://files-landing.socialgest.net/images/sgheadernew.webp |
| Tikket | https://files-landing.tikket.net/images/hometikket/tikketimageinbox.png |
| AdvocatesPro | https://magneticsuite.com/hubfs/Comp%201-1.gif |
| Quantico | https://quantico.ai/wp-content/uploads/2020/09/RRSS.gif |

### Mapeo de nombres
- Backend usa `"Advocates"` → Frontend muestra `"AdvocatesPro"`
- Se usa campo `backendName` en el array `allProducts` para hacer el match

---

## 🛡️ Panel de Administración (Implementado ✅)

### Routing basado en roles
- `isAdmin: true` → redirige a `/admin` después del login
- `isAdmin: false` → redirige a `/dashboard` después del login
- Acceso a `/admin` sin ser admin → redirige a `/dashboard`
- Acceso a cualquier ruta sin autenticación → redirige a `/login`

### Componentes

| Archivo | Descripción |
|---------|-------------|
| `src/components/auth/AdminRoute.tsx` | Guard que verifica isAuthenticated + isAdmin |
| `src/components/layout/AdminLayout.tsx` | Layout con sidebar + header + Outlet |
| `src/pages/admin/AdminDashboard.tsx` | Stats: total usuarios, productos activos |
| `src/pages/admin/Users.tsx` | Tabla CRUD de usuarios (crear, editar, eliminar) |
| `src/pages/admin/AssignProducts.tsx` | Asignar/quitar productos por usuario |

### Rutas Admin
```
/admin           → AdminDashboard (stats overview)
/admin/users     → Users (tabla CRUD)
/admin/products  → AssignProducts (asignación de productos)
```

### Persistencia de Sesión
Se agregó `isCheckingAuth: boolean` al store de Zustand para evitar un race condition donde la ruta protegida redirigía a `/login` antes de que `checkAuth()` (async) terminara de validar el token. Tanto `ProtectedRoute` como `AdminRoute` muestran un spinner mientras `isCheckingAuth === true`.

### Endpoints API usados por el Admin

```typescript
// Usuarios
GET    /users                    → Lista todos los usuarios
POST   /users                    → Crear usuario
PUT    /users/:id                → Actualizar usuario
DELETE /users/:id                → Eliminar usuario
GET    /users/:id/products       → Productos asignados a un usuario

// Productos (admin)
GET    /products/all             → Todos los productos del sistema
POST   /products/assign/:userId  → Asignar producto a usuario
DELETE /products/user-product/:id → Quitar producto de usuario
```

---

## 🔗 Flujo SSO Detallado

### Concepto
Un único `JWT_SECRET` global se configura en el `.env` de Magnetic **y** de cada producto. No es por usuario, es una clave compartida entre sistemas.

### Flujo completo
```
1. Usuario demo@magnetic.com tiene en Magnetic:
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

5. Frontend abre URL en nueva pestaña (window.open)

6. Advocates recibe el token, lo valida con el MISMO JWT_SECRET,
   extrae sub="admin@fluvip.com" y autentica al usuario
```

### Requisito en cada producto externo
Cada producto solo necesita **un endpoint nuevo**:
```
GET /auth/sso?token=<jwt>
```
Este endpoint valida el JWT con el `JWT_SECRET` compartido, extrae el `sub` (que es el `externalUserId`), busca al usuario en su propia base de datos, y crea una sesión local.

---

## 🎯 Comandos Útiles

### Desarrollo
```bash
# Frontend
cd magnetic-frontend
npm run dev              # Inicia servidor de desarrollo
npm run build            # Build para producción
npm run preview          # Preview del build

# Backend
cd magnetic-backend
npm run start:dev        # Inicia servidor con hot-reload
npm run seed:demo        # Crea usuarios y productos de prueba
npm run build            # Compila TypeScript
npm run start:prod       # Inicia servidor de producción
```

### Testing
```bash
# Frontend (cuando se implemente)
npm run test             # Ejecuta tests unitarios
npm run test:e2e         # Ejecuta tests E2E

# Backend (cuando se implemente)
npm run test             # Ejecuta tests unitarios
npm run test:e2e         # Ejecuta tests E2E
```

---

## 📚 Recursos Adicionales

### Documentación
- [React](https://react.dev/) - Framework frontend
- [TypeScript](https://www.typescriptlang.org/) - Lenguaje tipado
- [Vite](https://vitejs.dev/) - Build tool
- [TailwindCSS](https://tailwindcss.com/) - Framework CSS
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [NestJS](https://nestjs.com/) - Framework backend

### Estado Actualizado
**Última actualización:** Enero 2026
**Versión Frontend:** v1.4.0 (MVP + AI + Métricas + FAQ + Design System + E2E Testing)
**Versión Backend:** v1.1.0 (Completo con AI + Auth + Conexión Productos)

---

## 🎨 Design System - Tokens y Especificaciones (✅ APLICADO)

El frontend aplica un Design System unificado. Estos tokens son la fuente de verdad para cualquier componente nuevo.

### Colores

#### Primarios (Botones, Links, Acciones)
| Token | Hex | Uso |
|-------|-----|-----|
| `primary-50` | `#e6efff` | Background hover suave |
| `primary-100` | `#b3d1ff` | Background de icon badges |
| `primary-200` | `#80b3ff` | Hover de icon badges |
| `primary-600` | `#0058E7` | **Default** de botones primarios |
| `primary-700` | `#0045B4` | **Hover** de botones primarios |

#### Danger (Acciones destructivas)
| Token | Hex | Uso |
|-------|-----|-----|
| `danger-500` | `#EE4A79` | Default de botones danger |
| `danger-600` | `#D9436E` | Hover de botones danger |

#### Semánticos
| Token | Hex | Uso |
|-------|-----|-----|
| `success` | `#3ACE76` | Badges activos, toast success, indicadores |
| `error` | `#FC3E3E` | Toast error, badges error, validación |
| `warning` | `#FF962C` | Toast warning |

#### Grises
| Token | Hex | Uso |
|-------|-----|-----|
| `grey-50` | `#ececec` | Bordes, separadores |
| `grey-100` | `#c3c3c3` | Iconos inactivos, placeholders |
| `grey-300` | `#7d7d7d` | Texto secundario |
| `grey-400` | `#5d5d5d` | Labels de formularios |
| `grey-500` | `#3d3d3d` | Texto principal, títulos |

#### Fondos
| Token | Hex | Uso |
|-------|-----|-----|
| `white-600` | `#FAFAFA` | — |
| `white-700` | `#F1F1F1` | Background de página, hovers suaves |

### Iconos SVG

Todos los iconos del proyecto siguen estas especificaciones:

```tsx
<svg
  className="w-5 h-5"          // Tamaño estándar (w-4 h-4 para small, w-6 h-6 para large)
  fill="none"                   // Siempre none (outline style)
  stroke="currentColor"         // Color heredado del contenedor
  viewBox="0 0 24 24"
>
  <path
    strokeLinecap="round"       // Obligatorio
    strokeLinejoin="round"      // Obligatorio
    strokeWidth={1.66667}       // ⚠️ NO usar 2, siempre 1.66667
    d="..."
  />
</svg>
```

**Set de iconos:** Heroicons Outline (compatibles con el design system).

### Botones

#### Primario (filled)
```tsx
className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
```

#### Secundario / Outline
```tsx
className="px-4 py-2 text-sm font-medium text-grey-400 bg-white border border-grey-50 hover:bg-white-700 rounded-lg transition-colors"
```

#### Danger
```tsx
className="px-4 py-2 bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium rounded-lg"
```

#### Icon button (tabla, acciones)
```tsx
className="p-2 text-grey-100 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
```

### Border Radius

| Elemento | Clase | Valor |
|----------|-------|-------|
| Botones | `rounded-lg` | 12px (overridden en tailwind.config.js) |
| Cards | `rounded-lg` o `rounded-xl` | 12px / 16px |
| Inputs | `rounded-lg` | 12px |
| Modales | `rounded-lg` | 12px |
| Badges/Pills | `rounded-full` | 9999px |

### Inputs

```tsx
<input
  className="w-full px-4 py-3 border border-grey-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
  // Para inputs más compactos (admin):
  className="w-full px-3 py-2 border border-grey-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
/>
```

### Toast Notifications (react-hot-toast)

Configurados en `App.tsx`:

| Tipo | Border Left | Icon Color | Icon BG |
|------|------------|------------|---------|
| Success | `4px solid #3ACE76` | `#3ACE76` | `#EBFAF1` |
| Error | `4px solid #FC3E3E` | `#FC3E3E` | `#FEF2F2` |

```tsx
// Estilos base de todos los toasts:
style: {
  borderRadius: '10px',
  padding: '16px',
  fontSize: '14px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
}
```

### Badges de Estado

```tsx
// Activo
className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success/20 text-success"

// Inactivo
className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-white-700 text-grey-300"

// Conectado
className="text-xs font-medium text-success bg-success/20 px-2 py-0.5 rounded-full"

// No conectado
className="text-xs font-medium text-grey-300 bg-white-700 px-2 py-0.5 rounded-full"
```

### Alertas / Banners de Error

```tsx
// Error container
className="bg-error/10 border border-error/30 rounded-lg"

// Success container
className="bg-success/10 border border-success/30 rounded-lg"
```

**⚠️ NO usar colores hardcodeados de Tailwind como `border-red-200`, `bg-green-50`, etc.** Siempre usar los tokens del design system (`border-error/30`, `bg-success/10`).

### Modales

```tsx
// Overlay
className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"

// Container
className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl"

// Header
className="px-6 py-4 border-b border-grey-50"

// Footer actions
className="flex items-center justify-end gap-3 pt-2"
```

### Tailwind Config (tailwind.config.js)

Overrides importantes en la configuración:

```js
theme: {
  extend: {
    colors: {
      primary: { 600: '#0058E7', 700: '#0045B4', /* ... */ },
      danger: { 500: '#EE4A79', 600: '#D9436E' },
      grey: { /* escala completa 50-900 */ },
      success: '#3ACE76',
      error: '#FC3E3E',
      warning: '#FF962C',
    },
    borderRadius: {
      'ds': '12px',
      'lg': '12px',  // Override: rounded-lg = 12px
    },
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    },
  },
}
```

### Cambios Aplicados (Resumen)

| Cambio | Archivos Afectados | Detalle |
|--------|--------------------|---------|
| strokeWidth 2 → 1.66667 | Todos los .tsx (70 instancias) | Grosor de trazo de iconos SVG |
| Toast design system | App.tsx | Border-left coloreado, iconTheme |
| bg-primary-500 → 600 | Login, Register, ForgotPassword, TopBanner | Botones primarios |
| hover:bg-primary-600 → 700 | Login, Register, ForgotPassword, TopBanner | Hover de botones |
| bg-green-50/border-green-200 | ForgotPassword.tsx | → bg-success/10 border-success/30 |
| border-red-200 | ProductMetrics.tsx, Users.tsx | → border-error/30 |
| AdminLayout AI button | AdminLayout.tsx | Outline → solid primary rounded-lg |
| danger-500/600 | Users.tsx, ProductMetrics.tsx | Botones de eliminar/reconectar |
| rounded-lg override | tailwind.config.js | 12px en vez de 8px default |

---

## 🧪 Testing E2E - Playwright (✅ CONFIGURADO)

### Setup
- **Framework:** Playwright (gratuito, open source)
- **Navegador:** Chromium
- **Directorio:** `e2e/`
- **Config:** `playwright.config.ts`

### Requisitos para ejecutar
1. Backend corriendo en `http://localhost:3000`
2. Seeds ejecutados (`npm run seed:demo` en backend)
3. Frontend corriendo en `http://localhost:5173` (o Playwright lo levanta automáticamente)

### Comandos

```bash
npm run test:e2e          # Ejecutar todos los tests (headless)
npm run test:e2e:headed   # Ejecutar con navegador visible
npm run test:e2e:ui       # Abrir UI interactiva de Playwright
npm run test:e2e:report   # Ver último reporte HTML
```

### Archivos de Tests

| Archivo | Flujos Cubiertos |
|---------|-----------------|
| `e2e/helpers.ts` | Funciones reutilizables: loginAsDemo, loginAsAdmin |
| `e2e/auth.spec.ts` | Login correcto/incorrecto, toggle password, cambio de idioma, redirección sin auth, navegación a register/forgot |
| `e2e/dashboard.spec.ts` | Carga de productos, TopBanner, botones acceder, AI drawer, FAQ drawer, navegación a métricas |
| `e2e/connect-product.spec.ts` | Modal de conexión, credenciales inválidas, cerrar modal, página de métricas, botón sync |
| `e2e/admin.spec.ts` | Dashboard admin, navegación sidebar, tabla usuarios, modal crear usuario, acciones editar/eliminar, control de acceso (non-admin → redirect) |
| `e2e/profile.spec.ts` | Datos de perfil, campos nombre/apellido, cambio de contraseña con validaciones, error contraseña actual incorrecta, submit deshabilitado si no coinciden |
| `e2e/forgot-password.spec.ts` | Forgot password flow, success message, seguridad (email inexistente), registro con validaciones, enable/disable submit |

### Usuarios de prueba usados en tests

| Usuario | Email | Password | Rol |
|---------|-------|----------|-----|
| Demo | `demo@magnetic.com` | `Demo123!` | Normal (4 productos) |
| Admin | `admin@magnetic.com` | `Admin123!` | Administrador |

### Patrones de Selectores por Página

Los componentes del frontend usan diferentes patrones de formulario. Es importante conocerlos para escribir tests correctos:

| Página/Componente | Patrón de Inputs | Selector Correcto |
|-------------------|------------------|-------------------|
| Login | `<input placeholder="...">` | `getByPlaceholder(/correo\|email/i)` |
| Register | `<input placeholder="...">` | `getByPlaceholder(/nombre\|name/i)` |
| Forgot Password | `<div>` labels, sin placeholder | `getByRole('textbox')` |
| Change Password | `<input placeholder="...">` | `getByPlaceholder(/actual\|current/i)` |
| ConnectProductModal | `<div>` labels, sin placeholder | `getByRole('textbox')` + `locator('input[type="password"]')` |
| Admin Create User | `<div>` labels | `getByRole('heading')` para detectar modal |

**Reglas aprendidas:**
- `getByLabel()` solo funciona con elementos HTML `<label>` con `for/id`. Este proyecto usa `<div>` como labels en modales → usar `getByRole('textbox')` o `getByPlaceholder()`
- `getByRole('textbox')` NO encuentra `input[type="password"]` → usar `locator('input[type="password"]')` para campos de contraseña
- Botón "Actualizar Contraseña" (no "Cambiar") → regex `/actualizar|update/i`
- Botón "Conectar" aparece tanto en cards como en modal → usar `.first()` para card, `.last()` para modal submit

### Notas
- Los tests usan selectores i18n-friendly (regex con ES/EN/PT) para funcionar en cualquier idioma
- El `webServer` en `playwright.config.ts` levanta `npm run dev` automáticamente si no está corriendo
- Screenshots se capturan automáticamente en caso de fallo
- Reportes HTML se generan después de cada ejecución
- Tests usan `test.skip()` para casos que dependen del estado (ej: no hay productos desconectados)

