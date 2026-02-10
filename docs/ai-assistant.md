# AI Assistant - Magnetic AI

## Architecture
```
Frontend (JWT Auth) → Backend POST /api/ai/chat → OpenAI API (gpt-4o-mini)
```
El backend actua como proxy seguro. La API key NUNCA esta en el frontend.

## Backend Module
```
src/modules/ai/
├── ai.module.ts          # Modulo configurado
├── ai.controller.ts      # POST /chat
├── ai.service.ts         # Logica + OpenAI + Rate limiting
└── dto/chat.dto.ts       # Validacion
```

## Endpoint: POST /ai/chat
**Guards:** JWT
```typescript
Body: { message: string, history?: { role: 'user'|'assistant', content: string }[] }
Response: { reply: string, usage: { promptTokens, completionTokens, totalTokens } }
Error 429: { statusCode: 429, message: "AI_RATE_LIMIT_EXCEEDED", retryAfter: number }
```

## System Prompt (dinamico)
Se construye automaticamente con los productos asignados al usuario:
```
Eres el asistente virtual de Magnetic Suite. Tu nombre es Magnetic AI.

El usuario {firstName} {lastName} tiene acceso a los siguientes productos:
- SocialGest: Gestion integral de redes sociales...
- Tikket: Sistema de tickets y soporte al cliente...
[solo los productos que el usuario tiene]

Reglas:
- Solo responde preguntas de los productos listados
- Si preguntan por producto sin acceso → sugiere contactar admin
- Responde en el mismo idioma de la pregunta
- Se conciso y util
- No inventes funcionalidades
```

## Rate Limiting
- 20 mensajes por hora por usuario
- Contador en memoria (escalable a Redis)
- Retorna 429 con `retryAfter` en segundos

## Environment Variables
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
```

## Costos
| Concepto | Costo |
|----------|-------|
| Input | ~$0.15 / 1M tokens |
| Output | ~$0.60 / 1M tokens |
| Mensaje promedio (~350 tokens) | ~$0.0002 |
| 1000 mensajes/dia | ~$0.20/dia |
| 30,000 mensajes/mes | ~$6/mes |

## Frontend Components
- **ChatDrawer** (`src/components/ai/ChatDrawer.tsx`): Drawer lateral con historial
- **AIButton** (`src/components/ai/AIButton.tsx`): Boton flotante (legacy)
- Integrado en TopBanner y AdminLayout

## i18n Keys (seccion `ai` en translations.ts)
- `ai.title`, `ai.placeholder`, `ai.send`, `ai.thinking`
- `ai.rateLimitError`, `ai.errorMessage`, `ai.welcome`
