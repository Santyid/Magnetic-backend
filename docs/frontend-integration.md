# Frontend-Backend Integration

## API Configuration
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
```

## Axios Interceptors
- Request: Agrega `Authorization: Bearer <token>` automaticamente
- Response: Si 401 → intenta refresh token → si falla → redirect a login

## TypeScript Interfaces
```typescript
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
  productEmail?: string;
  enableMetrics: boolean;
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

## Pages & Routes

| Ruta | Pagina | Acceso |
|------|--------|--------|
| `/` | Landing.tsx | Publico |
| `/login` | Login.tsx | Publico |
| `/login-new` | LoginNew.tsx | Publico (glass-morphism) |
| `/register` | Register.tsx | Publico |
| `/forgot-password` | ForgotPassword.tsx | Publico |
| `/dashboard` | Dashboard.tsx | JWT |
| `/dashboard/metrics/:slug` | ProductMetrics.tsx | JWT |
| `/profile` | Profile.tsx | JWT |
| `/change-password` | ChangePassword.tsx | JWT |
| `/admin` | AdminDashboard.tsx | JWT + Admin |
| `/admin/users` | Users.tsx | JWT + Admin |
| `/admin/products` | AssignProducts.tsx | JWT + Admin |

## Role-Based Routing
- `isAdmin: true` → redirige a `/admin` despues del login
- `isAdmin: false` → redirige a `/dashboard` despues del login
- Sin auth → redirige a `/login`

## Product Cards (Dashboard)

### Seccion "Mis Productos"
- Cards con preview image + imagotipo + descripcion
- Badge de estado (conectado/no conectado)
- Boton "Acceder" → SSO redirect en nueva pestana (`window.open`)
- Badge custom domain (purpura, solo Advocates)

### Seccion "Agregar Productos"
- Solo muestra productos que el usuario NO tiene
- Cards con preview + boton "Visitar sitio" (nueva pestana)

### URLs de Productos
| Producto | URL | Preview |
|----------|-----|---------|
| SocialGest | https://socialgest.net/es | https://files-landing.socialgest.net/images/sgheadernew.webp |
| Tikket | https://www.tikket.net/es | https://files-landing.tikket.net/images/hometikket/tikketimageinbox.png |
| AdvocatesPro | https://magneticsuite.com/advocatespro | https://magneticsuite.com/hubfs/Comp%201-1.gif |
| Quantico | https://quantico.ai/ | https://quantico.ai/wp-content/uploads/2020/09/RRSS.gif |

> Backend usa "Advocates" → Frontend muestra "AdvocatesPro" (mapeo via `backendName`)

## Admin Panel

### Components
| Archivo | Descripcion |
|---------|-------------|
| `AdminRoute.tsx` | Guard: isAuthenticated + isAdmin |
| `AdminLayout.tsx` | Layout con sidebar + header + AI + FAQ |
| `AdminDashboard.tsx` | Stats: total usuarios, productos activos |
| `Users.tsx` | Tabla CRUD con modales |
| `AssignProducts.tsx` | Asignar/quitar productos + badge conexion |

### Admin API Calls
```typescript
GET    /users                    // Lista usuarios
POST   /users                    // Crear usuario
PUT    /users/:id                // Actualizar usuario
DELETE /users/:id                // Eliminar usuario
GET    /users/:id/products       // Productos de usuario
GET    /products/all             // Todos los productos
POST   /products/assign/:userId  // Asignar producto
DELETE /products/user-product/:id // Quitar producto
```

## Frontend File Structure
```
src/
├── assets/images/              # Logos, backgrounds, isotipos, imagotipos
├── components/
│   ├── ai/                     # AIButton, ChatDrawer
│   ├── auth/                   # ProtectedRoute, AdminRoute
│   ├── dashboard/              # ConnectProductModal
│   ├── help/                   # FAQDrawer
│   ├── landing/                # Navbar, Hero, ProductsShowcase, Features, Stats, CTA, Footer
│   ├── layout/                 # TopBanner, AdminLayout
│   └── ui/                     # LanguageSelector, Skeleton
├── i18n/                       # translations.ts, landingTranslations.ts, LanguageContext.tsx
├── pages/                      # Login, Register, Dashboard, Profile, admin/*
├── services/api.ts             # Axios client + interceptors
├── store/authStore.ts          # Zustand state
├── styles/animations.css       # Landing page animations
└── types/index.ts              # TypeScript interfaces
```

## Assets
| Asset | Ubicacion | Uso |
|-------|-----------|-----|
| Background | `src/assets/images/magnetic-background.webp` | Auth pages |
| Logo | `src/assets/images/powered-by-magnetic-logo.svg` | Footer auth |
| Isologo | `src/assets/images/Isologo-Black.png` | TopBanner |
| Isotipos | `src/assets/images/*-Isotipo-Blue.png` | Cards (4 productos) |
| Imagotipos | `src/assets/images/*-Imagotipo-Blue.png` | Cards, Landing (4 productos) |
| Favicon | `public/favicon.svg` | Browser tab |
