# Prompt: Debug Guide

## Step 1: Health Check
```bash
curl http://localhost:3000/api/health | python3 -m json.tool
```
Revisar:
- `services.database.status` → Si es "error", problema de conexion a PostgreSQL
- `services.openai.status` → Falta `OPENAI_API_KEY`
- `services.encryption.status` → `CREDENTIALS_ENCRYPTION_KEY` invalida (necesita 64 hex chars)
- `services.jwt.status` → `JWT_SECRET` es el default (inseguro)
- `endpoints.*.missing` → Endpoints que no se registraron correctamente

## Step 2: Environment Variables
Verificar `.env` tiene todas las variables de `.env.example`:
```bash
diff <(grep -oP '^[A-Z_]+' .env.example | sort) <(grep -oP '^[A-Z_]+' .env | sort)
```

## Step 3: Database
```bash
# Verificar conexion
psql -h localhost -U postgres -d magnetic_db -c "SELECT 1"

# Verificar tablas
psql -h localhost -U postgres -d magnetic_db -c "\dt"

# Re-ejecutar seeds si necesario
npm run seed:demo
```

## Step 4: Common Issues

### CORS Error
- Verificar `CORS_ORIGIN` en `.env` coincide EXACTAMENTE con la URL del frontend
- En Railway: debe ser `https://`, no `http://`

### JWT Invalid
- Verificar `JWT_SECRET` y `JWT_REFRESH_SECRET` en `.env`
- Token expirado → el frontend deberia hacer refresh automatico

### 401 Unauthorized
- Token no enviado → verificar header `Authorization: Bearer <token>`
- Token expirado → hacer refresh
- Usuario eliminado/desactivado

### 500 Internal Server Error
- Revisar logs del servidor NestJS
- Comun: entidad no encontrada, relacion rota, campo null inesperado

### Credenciales de producto invalidas
- Verificar que la API externa del producto esta disponible
- Probar credenciales directamente contra la API externa
- Para Advocates: verificar que el subdominio es correcto

## Step 5: Logs
```bash
# Desarrollo (con hot-reload y logs detallados)
npm run start:dev

# Los errores de NestJS muestran stack trace completo en development
```
