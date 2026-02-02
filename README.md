# Login Magnetic - Backend

Sistema de autenticación unificado (SSO) para centralizar el acceso a los productos de la empresa.

## Tecnologías

- **Node.js** v20+
- **NestJS** - Framework backend
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Base de datos
- **JWT** - Autenticación
- **TypeScript** - Lenguaje

## Instalación

### 1. Clonar repositorio e instalar dependencias

```bash
npm install
```

### 2. Configurar base de datos PostgreSQL

Crear una base de datos PostgreSQL:

```bash
# Usando psql
createdb magnetic_db

# O con Docker
docker run --name magnetic-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=magnetic_db -p 5432:5432 -d postgres
```

### 3. Configurar variables de entorno

Copiar el archivo de ejemplo y configurar las variables:

```bash
cp .env.example .env
```

Editar el archivo `.env` con tus configuraciones:

```env
PORT=3000
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=tu_password
DATABASE_NAME=magnetic_db

JWT_SECRET=tu-secret-super-seguro
JWT_REFRESH_SECRET=tu-refresh-secret-super-seguro

CORS_ORIGIN=http://localhost:5173
```

## Scripts disponibles

```bash
# Desarrollo (con hot-reload)
npm run start:dev

# Producción
npm run build
npm run start:prod

# Debug
npm run start:debug
```

## Estructura del Proyecto

```
src/
├── config/
│   └── configuration.ts          # Configuración centralizada
├── modules/
│   ├── auth/                     # Autenticación JWT
│   │   ├── dto/
│   │   ├── guards/
│   │   ├── strategies/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── users/                    # Gestión de usuarios
│   │   ├── entities/
│   │   ├── dto/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── products/                 # Gestión de productos
│   │   ├── entities/
│   │   ├── dto/
│   │   ├── products.controller.ts
│   │   ├── products.service.ts
│   │   └── products.module.ts
│   └── sessions/                 # Gestión de sesiones
│       ├── entities/
│       ├── sessions.service.ts
│       └── sessions.module.ts
├── app.module.ts                 # Módulo principal
└── main.ts                       # Punto de entrada
```

## API Endpoints

### Autenticación

```
POST   /api/auth/register         # Registrar usuario
POST   /api/auth/login            # Iniciar sesión
POST   /api/auth/refresh          # Renovar token
POST   /api/auth/logout           # Cerrar sesión
GET    /api/auth/me               # Usuario actual
```

### Usuarios (requiere autenticación)

```
GET    /api/users                 # Listar usuarios (admin)
POST   /api/users                 # Crear usuario (admin)
GET    /api/users/:id             # Obtener usuario
PATCH  /api/users/:id             # Actualizar usuario
DELETE /api/users/:id             # Eliminar usuario (admin)
```

### Productos (requiere autenticación)

```
GET    /api/products              # Productos del usuario
POST   /api/products              # Crear producto (admin)
GET    /api/products/:slug/access # Generar token de acceso
POST   /api/products/assign/:userId  # Asignar producto (admin)
DELETE /api/products/:productId/user/:userId # Quitar producto (admin)
```

## Inicializar Productos

Después de levantar el servidor, debes crear los 4 productos base. Usa estas requests:

### 1. Registrar un usuario administrador

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@magnetic.com",
    "password": "Admin123!",
    "firstName": "Admin",
    "lastName": "Magnetic"
  }'
```

Luego en la base de datos, marca este usuario como admin:

```sql
UPDATE users SET is_admin = true WHERE email = 'admin@magnetic.com';
```

### 2. Login como admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@magnetic.com",
    "password": "Admin123!"
  }'
```

Guarda el `accessToken` que te devuelve.

### 3. Crear los productos

```bash
# SocialGest
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "name": "SocialGest",
    "slug": "socialgest",
    "baseUrl": "https://socialgest.com",
    "description": "Gestión de redes sociales"
  }'

# Tikket
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "name": "Tikket",
    "slug": "tikket",
    "baseUrl": "https://tikket.com",
    "description": "Sistema de tickets y soporte"
  }'

# Advocates
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "name": "Advocates",
    "slug": "advocates",
    "baseUrl": "https://advocates.com",
    "description": "Plataforma de advocacy"
  }'

# Quantico
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d '{
    "name": "Quantico",
    "slug": "quantico",
    "baseUrl": "https://quantico.com",
    "description": "Analytics y métricas"
  }'
```

## Flujo de Autenticación

1. Usuario hace login → recibe `accessToken` y `refreshToken`
2. Usuario solicita acceso a un producto → recibe token SSO y URL de redirección
3. Frontend redirige al usuario al producto con el token
4. El producto valida el token con Login Magnetic
5. El producto crea/actualiza su sesión local

## Seguridad

- Passwords hasheados con bcrypt (10 rounds)
- JWT con expiración corta (15 min)
- Refresh tokens con expiración larga (7 días)
- CORS configurado
- Validación de DTOs con class-validator
- Guards para proteger rutas
- AdminGuard para operaciones administrativas

## Notas Importantes

- `synchronize: true` en TypeORM está habilitado solo para desarrollo
- Cambiar a `false` y usar migraciones en producción
- Cambiar los secrets de JWT en producción
- Configurar HTTPS en producción
- Implementar rate limiting para endpoints de auth

## Próximos Pasos

1. ✅ Backend completo con NestJS
2. 🔄 Frontend con React + TypeScript
3. 🔄 Dashboard de productos
4. 🔄 Integración con productos existentes
5. 🔄 Testing
6. 🔄 Deployment

## Soporte

Para más información, consulta el archivo [CLAUDE.md](CLAUDE.md) con la documentación completa del proyecto.
