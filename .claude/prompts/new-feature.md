# Prompt: Add New Feature

## Pre-Implementation
1. Explorar patrones existentes en modulos similares
2. Verificar si ya existe funcionalidad reutilizable en `src/common/`
3. Definir endpoints necesarios (ver `docs/api-reference.md`)

## Backend Implementation

### Si es modulo nuevo:
```bash
src/modules/<nombre>/
├── <nombre>.module.ts
├── <nombre>.controller.ts
├── <nombre>.service.ts
├── entities/
│   └── <entidad>.entity.ts
└── dto/
    └── <accion>.dto.ts
```

1. Crear entity con TypeORM decorators
2. Crear DTOs con class-validator
3. Implementar service con logica de negocio
4. Implementar controller con endpoints
5. Crear module y registrar en `app.module.ts`
6. Actualizar `health.controller.ts` con endpoints esperados

### Si es extension de modulo existente:
1. Agregar entity/DTO si necesario
2. Agregar metodo en service
3. Agregar endpoint en controller
4. Actualizar health controller

## Checklist Final
- [ ] DTOs con validacion (class-validator)
- [ ] Guards correctos (JWT, Admin)
- [ ] Codigos de error i18n (UPPER_SNAKE_CASE)
- [ ] Health controller actualizado
- [ ] Probado con curl / Postman
- [ ] Sin credenciales hardcodeadas
- [ ] Sin console.log en produccion (excepto errores)

## Referencia
- Auth module: `src/modules/auth/` (patron completo con guards, strategies, DTOs)
- Dashboard module: `src/modules/dashboard/` (patron con conectores externos)
- Common services: `src/common/services/` (cifrado, utilidades compartidas)
