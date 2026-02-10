# Testing E2E - Playwright

## Setup
- **Framework:** Playwright (gratuito, open source)
- **Navegador:** Chromium
- **Directorio:** `e2e/` (en frontend repo)
- **Config:** `playwright.config.ts`

## Requisitos
1. Backend corriendo en `http://localhost:3000`
2. Seeds ejecutados (`npm run seed:demo` en backend)
3. Frontend corriendo en `http://localhost:5173`

## Comandos
```bash
npm run test:e2e          # Todos los tests (headless)
npm run test:e2e:headed   # Con navegador visible
npm run test:e2e:ui       # UI interactiva de Playwright
npm run test:e2e:report   # Ver ultimo reporte HTML
```

## Test Files

| Archivo | Tests | Flujos Cubiertos |
|---------|-------|-----------------|
| `e2e/helpers.ts` | — | Funciones: loginAsDemo, loginAsAdmin |
| `e2e/auth.spec.ts` | 8 | Login correcto/incorrecto, toggle password, cambio idioma, redirect sin auth |
| `e2e/dashboard.spec.ts` | 7 | Carga productos, TopBanner, acceder, AI drawer, FAQ drawer, metricas |
| `e2e/connect-product.spec.ts` | 5 | Modal conexion, credenciales invalidas, cerrar modal, metricas, sync |
| `e2e/admin.spec.ts` | 8 | Dashboard admin, sidebar, tabla usuarios, crear usuario, editar/eliminar |
| `e2e/profile.spec.ts` | 8 | Datos perfil, nombre/apellido, cambio contrasena, validaciones |
| `e2e/forgot-password.spec.ts` | 9 | Forgot password, success message, registro con validaciones |

**Total: 45+ tests**

## Test Users
| Email | Password | Rol |
|-------|----------|-----|
| `demo@magnetic.com` | `Demo123!` | Normal (4 productos) |
| `admin@magnetic.com` | `Admin123!` | Administrador |

## Selector Patterns

Los componentes usan diferentes patrones de formulario:

| Pagina | Patron de Inputs | Selector Correcto |
|--------|------------------|-------------------|
| Login | `<input placeholder="...">` | `getByPlaceholder(/correo\|email/i)` |
| Register | `<input placeholder="...">` | `getByPlaceholder(/nombre\|name/i)` |
| Forgot Password | `<div>` labels | `getByRole('textbox')` |
| Change Password | `<input placeholder="...">` | `getByPlaceholder(/actual\|current/i)` |
| ConnectProductModal | `<div>` labels | `getByRole('textbox')` + `locator('input[type="password"]')` |
| Admin Create User | `<div>` labels | `getByRole('heading')` para detectar modal |

## Gotchas
- `getByLabel()` solo funciona con `<label for/id>`. Este proyecto usa `<div>` como labels → usar `getByRole('textbox')` o `getByPlaceholder()`
- `getByRole('textbox')` NO encuentra `input[type="password"]` → usar `locator('input[type="password"]')`
- Boton "Actualizar Contrasena" (no "Cambiar") → regex `/actualizar|update/i`
- Boton "Conectar" aparece en cards y modal → usar `.first()` para card, `.last()` para modal
- Tests usan regex i18n-friendly (ES/EN/PT) para funcionar en cualquier idioma
