# Creators Module - Meta Creator Marketplace

## Overview
Modulo para buscar creadores de contenido usando la Meta Creator Marketplace API (Facebook).

## Module Structure
```
src/modules/creators/
├── creators.module.ts
├── creators.controller.ts
├── creators.service.ts
├── creators.connector.ts    # Llamadas a Meta API
├── dto/
│   └── search-creators.dto.ts
└── interfaces/
    └── creator.interface.ts
```

## Meta Creator Marketplace API

### Authentication
- Requiere **Page Access Token** (no User Access Token)
- Obtener: `GET /{pageId}?fields=access_token` con User token
- Page ID: 1399344320367925 ("Santyid - Pagina Oficial")

### Endpoints
| Accion | Endpoint |
|--------|----------|
| Buscar creadores | `GET /creator_marketplace/creators?query={q}&fields=...` |
| Perfil por ID | `GET /creator_marketplace/creators?creator_id={id}&fields=...` |
| Contenido | `GET /creator_marketplace/content?creator_id={id}&fields=...` |

> **NO usar** `/{pageId}/creator_discovery_search` (endpoint incorrecto)

### Response Fields
Los campos usan prefijo `creator_`:
- `creator_id`, `creator_display_name`, `creator_alias`
- `creator_bio`, `creator_profile_image_url`
- `creator_follower_count`, `creator_categories`
- `creator_interests`, `creator_email`
- `creator_gender`, `creator_age_bucket`

### Content Types
`REELS`, `VIDEOS`, `PHOTOS`, `TEXT`

### Rate Limits
- 2000 requests/user/hour
- 10000 requests/app/hour

### Access Levels
| Nivel | Datos |
|-------|-------|
| Standard Access | Solo datos simulados/mock |
| Advanced Access | Datos reales (requiere App Review) |

> Instagram Creator Marketplace permission fue declinada; solo Facebook esta activo.

## Environment Variables
```env
META_APP_ID=<facebook-app-id>
META_APP_SECRET=<facebook-app-secret>
META_USER_ACCESS_TOKEN=<long-lived-user-token>
META_PAGE_ID=1399344320367925
```
