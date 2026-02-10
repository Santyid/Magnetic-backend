# Landing Page - Dark Theme

## Routes
| Ruta | Pagina | Descripcion |
|------|--------|-------------|
| `/` | Landing.tsx | Landing page publica |
| `/login` | Login.tsx | Login original |
| `/login-new` | LoginNew.tsx | Login con glass-morphism |

## Components
```
src/components/landing/
├── Navbar.tsx           # Fijo, glass effect al scroll (>50px)
├── Hero.tsx             # Full-screen, 4 orbs animados, gradient-text
├── ProductsShowcase.tsx # Grid 4 columnas, glass-morphism cards
├── Features.tsx         # Grid 3x2, 6 features con iconos
├── Stats.tsx            # 3 contadores animados (count-up)
├── CTASection.tsx       # Call-to-action con gradiente
└── Footer.tsx           # Footer dark con selector idioma
```

## Color Palette
| Elemento | Color | Uso |
|----------|-------|-----|
| Background | `#0a0a0f` | Fondo principal (casi negro) |
| Glass | `rgba(255,255,255,0.05)` | Cards con backdrop-blur |
| Borders | `rgba(255,255,255,0.1)` | Bordes sutiles |
| Text Primary | `#ffffff` | Titulos |
| Text Secondary | `#a1a1aa` | Subtitulos |
| Accent Primary | `#0058E7` | Botones, links, CTAs |
| Accent Secondary | `#ae4a79` | Acentos alternos |

## CSS Animations (`src/styles/animations.css`)
| Animacion | Descripcion | Duracion |
|-----------|-------------|----------|
| `float` | Orbs flotantes suaves | 8s infinite |
| `float-slow` | Orbs flotantes lentos | 12s infinite |
| `hero-fade-in` | Fade-in del hero | 1s ease-out |
| `reveal-up` | Reveal al scroll | 0.8s ease-out |
| `reveal-scale` | Reveal con scale (stats) | 0.8s ease-out |
| `gradient-shift` | Gradiente en texto | 3s ease infinite |
| `pulse-glow` | Pulse para numeros | 2s ease-in-out infinite |

## CSS Utility Classes
```css
.glass          /* Glass-morphism estandar */
.glass-dark     /* Glass oscuro */
.glass-light    /* Glass claro (login) */
.gradient-text  /* Texto con gradiente animado */
.orb            /* Base para orbs */
.orb-primary    /* Orb azul */
.orb-secondary  /* Orb rosa/purpura */
.hover-lift     /* Elevacion en hover */
.hover-glow     /* Glow en hover */
```

## Stats (count-up)
- "4 productos", "3 idiomas", "24/7 soporte"
- Custom hook `useCountUp(end, duration, start)` con Intersection Observer

## i18n
Archivo separado: `src/i18n/landingTranslations.ts`
```typescript
const t = landingTranslations[language]; // 'es' | 'en' | 'pt'
// Secciones: t.nav, t.hero, t.products, t.features, t.stats, t.cta, t.footer, t.loginNew
```

## Accessibility
- `prefers-reduced-motion`: Desactiva animaciones
- Contraste WCAG AA
- Links con focus visible
- Alt text en imagenes
