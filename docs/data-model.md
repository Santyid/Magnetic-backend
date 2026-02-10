# Data Model

## Entity: User
```typescript
@Entity('users')
User {
  id: UUID (PK, auto-generated)
  email: string (unique)
  password: string (bcrypt hash)
  firstName: string
  lastName: string
  avatar?: string
  isActive: boolean (default: true)
  isAdmin: boolean (default: false)
  createdAt: DateTime
  updatedAt: DateTime
}
```

## Entity: Product
```typescript
@Entity('products')
Product {
  id: UUID (PK, auto-generated)
  name: string           // "SocialGest", "Tikket", "Advocates", "Quantico"
  slug: string (unique)  // "socialgest", "tikket", "advocates", "quantico"
  baseUrl: string        // URL del producto
  description?: string
  logoUrl?: string
  isActive: boolean (default: true)
}
```

## Entity: UserProduct
Relacion N:M entre usuarios y productos.
```typescript
@Entity('user_products')
UserProduct {
  id: UUID (PK, auto-generated)
  userId: UUID (FK → users)
  productId: UUID (FK → products)
  externalUserId: string     // ID del usuario en el producto externo
  customDomain?: string      // Para Advocates: subdominio personalizado
  productEmail?: string      // Email en el producto externo
  encryptedPassword?: string // Contrasena cifrada AES-256-GCM
  apiToken?: string          // Token API cifrado (alternativa a password)
  enableMetrics: boolean     // Si se muestran metricas (default: false)
  metadata?: JSON            // Datos adicionales por producto
  isActive: boolean (default: true)
  createdAt: DateTime

  // Relations
  user: User
  product: Product
}
```

### Deteccion de conexion
```typescript
const isConnected = userProduct.productEmail && userProduct.enableMetrics;
```

## Entity: Session
```typescript
@Entity('sessions')
Session {
  id: UUID (PK, auto-generated)
  userId: UUID (FK → users)
  token: string
  refreshToken: string
  expiresAt: DateTime
  ipAddress: string
  userAgent: string
  createdAt: DateTime
}
```

## Entity: PasswordResetToken
```typescript
@Entity('password_reset_tokens')
PasswordResetToken {
  id: UUID (PK, auto-generated)
  userId: UUID (FK → users)
  token: string        // Hash del token
  expiresAt: DateTime  // 1 hora desde creacion
  used: boolean        // Se marca true despues de usar
  createdAt: DateTime
}
```

## Relationships
```
User 1──N UserProduct N──1 Product
User 1──N Session
User 1──N PasswordResetToken
```
