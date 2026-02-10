# Prompt: Add New API Endpoint

## Checklist

1. **DTO**: Crear en `src/modules/<modulo>/dto/` con class-validator decorators
   ```typescript
   import { IsString, IsOptional, MinLength } from 'class-validator';
   export class MiActionDto {
     @IsString()
     campo: string;
   }
   ```

2. **Controller**: Agregar metodo en el controller del modulo
   - Usar decoradores correctos: `@Get()`, `@Post()`, `@Patch()`, `@Delete()`
   - Agregar guards si necesario: `@UseGuards(JwtAuthGuard)` o `@UseGuards(JwtAuthGuard, AdminGuard)`
   - Inyectar usuario con `@Request() req` → `req.user`

3. **Service**: Implementar logica de negocio en el service
   - Inyectar repositorios con `@InjectRepository(Entity)`
   - Retornar codigos de error i18n (UPPER_SNAKE_CASE), no mensajes

4. **Module**: Si es modulo nuevo, registrar en `app.module.ts` imports

5. **Health Check**: Actualizar `src/health.controller.ts`
   - Agregar la ruta esperada al array `expectedEndpoints` del modulo correspondiente
   - Esto asegura que el health check valide que el endpoint esta registrado

6. **Test**: Probar con curl
   ```bash
   # Publico
   curl http://localhost:3000/api/nuevo-endpoint

   # Con JWT
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/nuevo-endpoint
   ```

## Patron de referencia
Ver `src/modules/auth/auth.controller.ts` para endpoints de auth.
Ver `src/modules/products/products.controller.ts` para CRUD con admin guards.
