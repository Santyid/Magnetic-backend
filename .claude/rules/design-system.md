# Design System Rules

## Colores Primarios (Botones, Links, Acciones)
| Token | Hex | Uso |
|-------|-----|-----|
| `primary-50` | `#e6efff` | Background hover suave |
| `primary-100` | `#b3d1ff` | Background de icon badges |
| `primary-200` | `#80b3ff` | Hover de icon badges |
| `primary-600` | `#0058E7` | **Default** de botones primarios |
| `primary-700` | `#0045B4` | **Hover** de botones primarios |

## Colores Danger
| Token | Hex | Uso |
|-------|-----|-----|
| `danger-500` | `#EE4A79` | Default botones danger |
| `danger-600` | `#D9436E` | Hover botones danger |

## Colores Semanticos
| Token | Hex | Uso |
|-------|-----|-----|
| `success` | `#3ACE76` | Badges activos, toast success |
| `error` | `#FC3E3E` | Toast error, validacion |
| `warning` | `#FF962C` | Toast warning |

## Grises
| Token | Hex | Uso |
|-------|-----|-----|
| `grey-50` | `#ececec` | Bordes, separadores |
| `grey-100` | `#c3c3c3` | Iconos inactivos, placeholders |
| `grey-300` | `#7d7d7d` | Texto secundario |
| `grey-400` | `#5d5d5d` | Labels de formularios |
| `grey-500` | `#3d3d3d` | Texto principal, titulos |

## Fondos
| Token | Hex |
|-------|-----|
| `white-600` | `#FAFAFA` |
| `white-700` | `#F1F1F1` |

## Iconos SVG
```tsx
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.66667} d="..." />
</svg>
```
- Tamano: `w-4 h-4` (small), `w-5 h-5` (standard), `w-6 h-6` (large)
- **strokeWidth: 1.66667** (NO usar 2)
- Set: Heroicons Outline

## Botones
```tsx
// Primario
className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"

// Secundario / Outline
className="px-4 py-2 text-sm font-medium text-grey-400 bg-white border border-grey-50 hover:bg-white-700 rounded-lg transition-colors"

// Danger
className="px-4 py-2 bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium rounded-lg"

// Icon button
className="p-2 text-grey-100 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
```

## Border Radius
| Elemento | Clase | Valor |
|----------|-------|-------|
| Botones, Cards, Inputs, Modales | `rounded-lg` | 12px |
| Cards grandes | `rounded-xl` | 16px |
| Badges/Pills | `rounded-full` | 9999px |

`rounded-lg` esta overrideado a 12px en `tailwind.config.js`.

## Inputs
```tsx
// Standard
className="w-full px-4 py-3 border border-grey-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"

// Compacto (admin)
className="w-full px-3 py-2 border border-grey-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
```

## Toasts (react-hot-toast)
| Tipo | Border Left | Icon Color | Icon BG |
|------|------------|------------|---------|
| Success | `4px solid #3ACE76` | `#3ACE76` | `#EBFAF1` |
| Error | `4px solid #FC3E3E` | `#FC3E3E` | `#FEF2F2` |

## Badges de Estado
```tsx
// Activo
className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success/20 text-success"

// Inactivo
className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-white-700 text-grey-300"
```

## Alertas
```tsx
// Error
className="bg-error/10 border border-error/30 rounded-lg"

// Success
className="bg-success/10 border border-success/30 rounded-lg"
```

**NO usar colores hardcodeados de Tailwind** como `border-red-200`, `bg-green-50`. Siempre usar tokens del design system.

## Modales
```tsx
// Overlay
className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
// Container
className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl"
// Header
className="px-6 py-4 border-b border-grey-50"
```

## Font
```js
fontFamily: { sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'] }
```
