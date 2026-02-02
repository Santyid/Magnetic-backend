# 🚀 Inicio Rápido - Login Magnetic

## Pasos para levantar el proyecto en 5 minutos

### 1️⃣ Base de Datos PostgreSQL

**Opción A: Con Docker (recomendado)**
```bash
docker run --name magnetic-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=magnetic_db \
  -p 5432:5432 -d postgres
```

**Opción B: PostgreSQL local**
```bash
createdb magnetic_db
```

### 2️⃣ Configurar Variables de Entorno

```bash
cp .env.example .env
```

Edita `.env` si necesitas cambiar algo (por defecto funciona con localhost).

### 3️⃣ Instalar Dependencias (si no lo hiciste)

```bash
npm install
```

### 4️⃣ Levantar el Servidor

```bash
npm run start:dev
```

Deberías ver:
```
🚀 Servidor corriendo en: http://localhost:3000/api
```

### 5️⃣ Configurar Demo Completo (AUTOMÁTICO)

**Este comando hace TODO por ti:**
- ✅ Crea los 4 productos (SocialGest, Tikket, Advocates, Quantico)
- ✅ Crea usuario admin
- ✅ Crea usuario demo con los 4 productos asignados

```bash
npm run seed:demo
```

**Salida esperada:**
```
🚀 Configurando demo completo de Login Magnetic...

✅ Conexión a la base de datos establecida

📦 Creando productos...
  ✅ SocialGest creado
  ✅ Tikket creado
  ✅ Advocates creado
  ✅ Quantico creado

👤 Creando usuario administrador...
  ✅ Usuario admin creado
     Email: admin@magnetic.com
     Password: Admin123!

👤 Creando usuario demo...
  ✅ Usuario demo creado
     Email: demo@magnetic.com
     Password: Demo123!

🔗 Asignando productos al usuario demo...
  ✅ SocialGest asignado
  ✅ Tikket asignado
  ✅ Advocates asignado
  ✅ Quantico asignado

═══════════════════════════════════════════════════════
🎉 Setup demo completado exitosamente!
═══════════════════════════════════════════════════════

📝 Credenciales de prueba:

👨‍💼 Usuario Admin:
   Email:    admin@magnetic.com
   Password: Admin123!
   Rol:      Administrador (puede gestionar usuarios)

👤 Usuario Demo:
   Email:    demo@magnetic.com
   Password: Demo123!
   Productos: SocialGest, Tikket, Advocates, Quantico
```

---

## 🧪 Probar el Sistema

### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@magnetic.com",
    "password": "Demo123!"
  }'
```

**Respuesta:**
```json
{
  "user": {
    "id": "uuid-del-usuario",
    "email": "demo@magnetic.com",
    "firstName": "Demo",
    "lastName": "User",
    "isAdmin": false
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Guarda el `accessToken`.**

### 2. Ver Productos del Usuario

```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Respuesta:**
```json
[
  {
    "id": "product-uuid-1",
    "userId": "user-uuid",
    "productId": "socialgest-uuid",
    "externalUserId": "demo-socialgest-001",
    "customDomain": null,
    "product": {
      "id": "socialgest-uuid",
      "name": "SocialGest",
      "slug": "socialgest",
      "baseUrl": "https://socialgest.com",
      "logoUrl": null,
      "description": "Gestión de redes sociales"
    }
  },
  // ... los otros 3 productos
]
```

### 3. Generar Token SSO para Acceder a un Producto

```bash
curl -X GET http://localhost:3000/api/products/quantico/access \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Respuesta:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "redirectUrl": "https://quantico.com/auth/sso?token=eyJhbGciOi..."
}
```

Este token contiene:
- ID del usuario en Login Magnetic
- Email del usuario
- `externalUserId`: "demo-quantico-004" (el ID en Quantico)
- Metadata adicional

### 4. Usuario Actual

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

---

## 🎯 Ahora tienes:

- ✅ Backend funcionando en `http://localhost:3000/api`
- ✅ Base de datos con productos creados
- ✅ 2 usuarios de prueba:
  - **Admin:** `admin@magnetic.com` / `Admin123!`
  - **Demo:** `demo@magnetic.com` / `Demo123!` (con 4 productos)
- ✅ Sistema de autenticación JWT completo
- ✅ Generación de tokens SSO para productos

---

## 📋 Próximos Pasos

1. **Probar todos los endpoints** con Postman o Thunder Client
2. **Crear el frontend** con React
3. **Integrar los productos externos** para que validen los tokens SSO

---

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
npm run start:dev

# Compilar para producción
npm run build

# Ejecutar en producción
npm run start:prod

# Solo crear productos (sin usuarios)
npm run seed

# Setup completo con demo (usuarios + productos)
npm run seed:demo
```

---

## 🆘 Problemas Comunes

### Error: "Connection refused" a PostgreSQL
```bash
# Verifica que PostgreSQL esté corriendo
docker ps

# O reinicia el contenedor
docker restart magnetic-postgres
```

### Error: "Port 3000 already in use"
```bash
# Cambia el puerto en .env
PORT=3001
```

### Error: "Table doesn't exist"
El proyecto usa `synchronize: true` en desarrollo, así que las tablas se crean automáticamente al levantar el servidor.

---

## 📚 Documentación Completa

Ver [README.md](README.md) para documentación detallada.
