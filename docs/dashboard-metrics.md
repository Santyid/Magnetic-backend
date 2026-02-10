# Dashboard - Connection & Metrics

## Concepto
Modelo hibrido: SSO (acceso directo) + Agregador de metricas.

1. **Admin asigna producto** a un usuario (sin credenciales, solo la relacion)
2. **Usuario ve el producto** en su dashboard como "no conectado"
3. **Usuario llena formulario** con sus credenciales del producto externo
4. **Backend valida credenciales** contra la API real del producto
5. Si validas → cifra con AES-256-GCM → guarda en BD → `enableMetrics = true`
6. Si invalidas → retorna error → usuario puede reintentar
7. Una vez conectado, dashboard muestra **metricas** del producto

## Cifrado de Credenciales
- Algoritmo: AES-256-GCM
- Servicio: `src/common/services/encryption.service.ts`
- Variable: `CREDENTIALS_ENCRYPTION_KEY` (generar con `openssl rand -hex 32`)
- Formato: `iv:authTag:encrypted` (hex)

## Campos en UserProduct
```typescript
productEmail?: string;        // Email/username en producto externo
encryptedPassword?: string;   // Contrasena cifrada AES-256-GCM
apiToken?: string;            // Token API cifrado (alternativa)
enableMetrics: boolean;       // Si se muestran metricas (default: false)
```

## Estados de Producto en Dashboard

| Estado | Deteccion | UI |
|--------|-----------|-----|
| No conectado | `!productEmail \|\| !enableMetrics` | Badge gris, boton "Conectar" |
| Conectado | `productEmail && enableMetrics` | Badge verde, boton "Acceder" |
| Error | Error al obtener metricas | Panel rojo, boton "Reconectar" |

## Endpoints

### POST /dashboard/connect/:userProductId
Conecta producto validando credenciales contra API externa.
```typescript
Body: { productEmail: string, password: string, subdomain?: string, apiToken?: string }
Response: { connected: true, message: "PRODUCT_CONNECTED_SUCCESSFULLY", product: { name, slug } }
Error: { statusCode: 400, message: "INVALID_PRODUCT_CREDENTIALS" }
```

### DELETE /dashboard/connect/:userProductId
Desconecta producto, borra credenciales cifradas.
```typescript
Response: { connected: false, message: "PRODUCT_DISCONNECTED_SUCCESSFULLY" }
```

### GET /dashboard/metrics
Metricas unificadas de todos los productos conectados.

### POST /dashboard/sync/:userProductId
Fuerza re-sincronizacion de metricas.

## Conectores de Productos

| Producto | Conector | Estado | API Base |
|----------|----------|--------|----------|
| AdvocatesPro | `advocates.connector.ts` | Implementado | `https://api.qa.advocatespro.com` |
| SocialGest | — | Pendiente | Por definir |
| Tikket | — | Pendiente | Por definir |
| Quantico | — | Pendiente | Por definir |

### Advocates Connector
```
src/modules/dashboard/connectors/advocates.connector.ts
```

Endpoints usados:
- **Login:** `POST https://api.qa.advocatespro.com/login` → `{ email, password, subdomain }`
- **Metricas:** `GET https://api.qa.advocatespro.com/get-metrics-dashboard-admin?typeFilter=all&year=YYYY`

### Metricas de Advocates (campos disponibles)
```json
{
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
```

### Mapeo de Metricas para Dashboard Cards
| Tarjeta | Campo API | Formato |
|---------|-----------|---------|
| Valorizacion acumulada | `acumulateValuation` | `$${(val/1000000).toFixed(2)}M COP` |
| Interacciones totales | `totalEngagement` | Numero directo |
| Total contenidos | `totalContent` | Numero directo |
| Alcance potencial | `totalPotentialReach` | `${(val/1000).toFixed(2)}K` |
| Alcance estimado | `totalEstimatedReach` | `${(val/1000).toFixed(2)}K` |

## Frontend Components

### ConnectProductModal (`src/components/dashboard/ConnectProductModal.tsx`)
- Modal con formulario: email/usuario + contrasena (toggle) + subdominio (solo Advocates)
- Label: "Email o usuario" (i18n)
- Llama `dashboardAPI.connectProduct()`

### ProductMetrics (`src/pages/ProductMetrics.tsx`)
- Ruta: `/dashboard/metrics/:slug`
- Stat cards en grid 3 columnas
- Botones: "Sincronizar", "Abrir producto" (SSO)

### API Frontend
```typescript
dashboardAPI.connectProduct(userProductId, data)    // POST /dashboard/connect/:id
dashboardAPI.disconnectProduct(userProductId)        // DELETE /dashboard/connect/:id
dashboardAPI.getMetrics()                            // GET /dashboard/metrics
dashboardAPI.syncProduct(userProductId)              // POST /dashboard/sync/:id
productsAPI.saveCredentials(userProductId, data)     // POST /products/credentials/:id (Admin)
productsAPI.deleteCredentials(userProductId)          // DELETE /products/credentials/:id (Admin)
```

## Codigos i18n
| Codigo | ES | EN | PT |
|--------|----|----|-----|
| `PRODUCT_CONNECTED_SUCCESSFULLY` | Producto conectado exitosamente | Product connected successfully | Produto conectado com sucesso |
| `INVALID_PRODUCT_CREDENTIALS` | Credenciales invalidas | Invalid credentials | Credenciais invalidas |
| `PRODUCT_NOT_FOUND` | Producto no encontrado | Product not found | Produto nao encontrado |
| `PRODUCT_DISCONNECTED_SUCCESSFULLY` | Producto desconectado | Product disconnected | Produto desconectado |
