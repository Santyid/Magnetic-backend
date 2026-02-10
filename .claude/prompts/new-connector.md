# Prompt: Add New Product Connector

## Context
Los conectores validan credenciales contra APIs externas y extraen metricas.
Patron de referencia: `src/modules/dashboard/connectors/advocates.connector.ts`

## Steps

1. **Crear conector** en `src/modules/dashboard/connectors/<producto>.connector.ts`
   ```typescript
   import { Injectable, HttpException } from '@nestjs/common';
   import axios from 'axios';

   @Injectable()
   export class <Producto>Connector {
     private readonly baseUrl = '<API_BASE_URL>';

     async authenticate(credentials: { email: string; password: string }): Promise<string> {
       try {
         const response = await axios.post(`${this.baseUrl}/login`, {
           email: credentials.email,
           password: credentials.password,
         });
         return response.data.token; // o el campo correspondiente
       } catch (error) {
         throw new HttpException('INVALID_PRODUCT_CREDENTIALS', 400);
       }
     }

     async getMetrics(token: string): Promise<any> {
       const response = await axios.get(`${this.baseUrl}/metrics`, {
         headers: { Authorization: `Bearer ${token}` },
       });
       return response.data;
     }
   }
   ```

2. **Registrar en DashboardModule** (`src/modules/dashboard/dashboard.module.ts`)
   ```typescript
   providers: [DashboardService, AdvocatesConnector, <Producto>Connector],
   ```

3. **Agregar al switch en DashboardService** (`src/modules/dashboard/dashboard.service.ts`)
   - En `connectProduct()`: agregar case para el slug del producto
   - En `getMetricsForProduct()`: agregar case para obtener metricas

4. **Probar conexion**
   ```bash
   # 1. Asignar producto al usuario (admin)
   POST /api/products/assign/:userId

   # 2. Conectar con credenciales
   POST /api/dashboard/connect/:userProductId
   Body: { "productEmail": "...", "password": "..." }

   # 3. Verificar metricas
   GET /api/dashboard/metrics
   ```

## Productos pendientes
| Producto | API Base | Auth | Estado |
|----------|----------|------|--------|
| SocialGest | Por definir | Por validar | Pendiente |
| Tikket | Por definir | Por validar | Pendiente |
| Quantico | Por definir | Por validar | Pendiente |
