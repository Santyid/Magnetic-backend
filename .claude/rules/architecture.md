# Architecture Rules

## Project Identity
**Login Magnetic** es un SSO (Single Sign-On) que centraliza el acceso a 4 productos sin modificar sus arquitecturas existentes.

## Products
| Producto | Particularidad |
|----------|---------------|
| SocialGest | BD independiente |
| Tikket | BD independiente |
| Advocates | Subdominios personalizados por cliente (ej: `cliente.advocates.com`) |
| Quantico | BD independiente |

## Critical Constraints
1. **NO modificar** las bases de datos existentes de los productos
2. **NO modificar** los servicios backend de los productos existentes
3. **NO modificar** la configuracion actual de cada producto
4. Cada producto mantiene su **autonomia total**
5. Login Magnetic debe ser **100% independiente**

## Tech Stack
| Capa | Tecnologia |
|------|-----------|
| Backend | Node.js + NestJS |
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Database | PostgreSQL (nueva, solo para Login Magnetic) |
| ORM | TypeORM |
| Auth | JWT + Refresh Tokens |
| Encryption | AES-256-GCM (credenciales de productos) |
| AI | OpenAI gpt-4o-mini (proxy seguro) |
| State | Zustand (frontend) |
| i18n | Custom context (ES/EN/PT) |

## Integration Strategy
- **Metodo:** Redireccion con tokens JWT (NO iframes)
- **Razon:** Subdominios de Advocates y restricciones de seguridad hacen inviable iframes
- **Flujo:** Login Magnetic genera token → redirige al producto → producto valida token
- SSO usa un `JWT_SECRET` compartido entre Magnetic y cada producto

## Module Structure
```
src/
├── main.ts
├── app.module.ts
├── health.controller.ts
├── config/configuration.ts
├── common/
│   └── services/encryption.service.ts
├── modules/
│   ├── auth/          # Login, register, JWT, refresh, sessions, password recovery
│   ├── users/         # CRUD usuarios
│   ├── products/      # CRUD productos, asignacion, credenciales
│   ├── sessions/      # Gestion de sesiones activas
│   ├── ai/            # Asistente AI (OpenAI proxy)
│   ├── dashboard/     # Conexion productos, metricas, conectores
│   └── creators/      # Meta Creator Marketplace
└── database/seeds/    # Setup demo + custom users
```

## Module Pattern (NestJS)
Cada modulo sigue la estructura:
```
module-name/
├── module-name.module.ts       # Registro de providers/controllers
├── module-name.controller.ts   # Endpoints HTTP
├── module-name.service.ts      # Logica de negocio
├── entities/                   # TypeORM entities
├── dto/                        # Data Transfer Objects (class-validator)
└── guards/ o strategies/       # Opcional: auth guards, JWT strategy
```

## Repositories
```
magnetic-backend/    # API NestJS (este repo)
magnetic-frontend/   # App React
```
