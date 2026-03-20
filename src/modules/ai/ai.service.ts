import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatDto } from './dto/chat.dto';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

@Injectable()
export class AiService {
  private openai: OpenAI;
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private readonly RATE_LIMIT = 20; // mensajes por hora
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora en ms

  constructor(
    private configService: ConfigService,
    private productsService: ProductsService,
    private usersService: UsersService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Verifica el rate limit del usuario
   */
  private checkRateLimit(userId: string): void {
    const now = new Date();
    const entry = this.rateLimitMap.get(userId);

    if (!entry) {
      // Primera vez del usuario
      this.rateLimitMap.set(userId, {
        count: 1,
        resetAt: new Date(now.getTime() + this.RATE_LIMIT_WINDOW),
      });
      return;
    }

    // Si pasó el tiempo, resetear
    if (now >= entry.resetAt) {
      this.rateLimitMap.set(userId, {
        count: 1,
        resetAt: new Date(now.getTime() + this.RATE_LIMIT_WINDOW),
      });
      return;
    }

    // Verificar límite
    if (entry.count >= this.RATE_LIMIT) {
      const secondsUntilReset = Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000);
      throw new HttpException(
        {
          statusCode: 429,
          message: 'AI_RATE_LIMIT_EXCEEDED',
          retryAfter: secondsUntilReset,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Incrementar contador
    entry.count += 1;
  }

  /**
   * Construye el system prompt dinámico basado en los productos del usuario
   */
  private async buildSystemPrompt(userId: string): Promise<string> {
    // Obtener usuario
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('USER_NOT_FOUND');
    }

    // Obtener productos del usuario
    const userProducts = await this.productsService.findUserProducts(userId);

    const productsList = userProducts
      .map((up) => `- ${up.product.name}: ${up.product.description || 'Producto de Magnetic Suite'}`)
      .join('\n');

    const systemPrompt = `Eres el asistente virtual de Magnetic Suite.
Tu nombre es Magnetic AI.

El usuario ${user.firstName} ${user.lastName} tiene acceso a los siguientes productos:
${productsList || '- (Ningún producto asignado)'}

Reglas:
- Solo responde preguntas relacionadas con los productos listados arriba
- Si preguntan por un producto que el usuario NO tiene, indica que no tiene acceso y sugiere contactar al administrador
- Responde en el mismo idioma en que te escriban (español, inglés o portugués)
- Sé conciso y útil
- No inventes funcionalidades que no existen
- Si no estás seguro de algo, admítelo

Información de los productos:
- SocialGest (socialgest.net): Gestión integral de redes sociales. Programación de posts, analytics, gestión de comunidad, monitoreo de menciones, reportes de engagement.
- Tikket (tikket.net): Sistema de tickets y soporte al cliente. Gestión de conversaciones multicanal, asignación inteligente de agentes, base de conocimiento, reportes de satisfacción.
- AdvocatesPro (magneticsuite.com/advocatespro): Plataforma de employee advocacy. Amplificación de marca a través de colaboradores, gestión de contenido, métricas de alcance, gamificación.
- Quantico (quantico.ai): Analytics y métricas avanzadas. Dashboards personalizables, reportes automatizados, insights con IA, integración de datos de múltiples fuentes.`;

    return systemPrompt;
  }

  /**
   * Envía un mensaje al chat de OpenAI
   */
  async chat(userId: string, chatDto: ChatDto) {
    try {
      // Verificar rate limit
      this.checkRateLimit(userId);

      // Construir system prompt dinámico
      const systemPrompt = await this.buildSystemPrompt(userId);

      // Construir mensajes
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Agregar historial si existe
      if (chatDto.history && chatDto.history.length > 0) {
        messages.push(
          ...chatDto.history.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        );
      }

      // Agregar mensaje actual del usuario
      messages.push({ role: 'user', content: chatDto.message });

      // Llamar a OpenAI
      const model = this.configService.get<string>('openai.model') || 'gpt-4o-mini';
      const maxTokens = this.configService.get<number>('openai.maxTokens') || 500;

      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const reply = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';

      return {
        reply,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 500,
          message: 'AI_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Identifies 3-4 main competitors for a company via OpenAI,
   * returning their LinkedIn company page slugs.
   */
  async identifyCompetitors(
    companyName: string,
    industry: string,
    country: string,
  ): Promise<string[]> {
    const model = this.configService.get<string>('openai.model') || 'gpt-4o-mini';

    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a business analyst expert in LinkedIn. Given a company name, industry, and country, return the EXACT LinkedIn company page slugs of 5-6 direct competitors. The slug is the part after linkedin.com/company/ in the company\'s LinkedIn URL. IMPORTANT: Use the real, verified LinkedIn slug — typically lowercase with hyphens (e.g. "banco-de-bogota", "davivienda", "bbva-colombia", "grupo-aval"). Do NOT guess or make up slugs. Only include companies you are confident have a LinkedIn page with that exact slug. Return ONLY a JSON object: {"slugs":["slug1","slug2","slug3","slug4","slug5"]}',
        },
        {
          role: 'user',
          content: `Company: ${companyName}\nIndustry: ${industry}\nCountry: ${country}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.slugs) ? parsed.slugs : [];
  }

  /**
   * Generates a competitive brand evaluation comparing the company
   * against its competitors using real engagement data.
   */
  async analyzeCompetitorBrand(data: {
    company: { name: string; followers: number; employeeCount: number; industry: string; engagement: { avgLikes: number; avgComments: number; engagementRate: number; postsPerMonth: number } };
    competitors: { name: string; followers: number; employeeCount: number; industry: string; engagement: { avgLikes: number; avgComments: number; engagementRate: number; postsPerMonth: number } }[];
  }): Promise<Record<string, unknown>> {
    const model = this.configService.get<string>('openai.model') || 'gpt-4o-mini';

    const systemPrompt = `Eres un analista senior de marca y comunicación digital. Analiza los datos reales de engagement de LinkedIn de una empresa y sus competidores directos para generar una evaluación competitiva de marca.

Responde ÚNICAMENTE con JSON válido (sin markdown) con esta estructura:
{
  "brandPosition": "1-2 oraciones describiendo la posición competitiva actual de la marca en LinkedIn vs sus competidores",
  "strengths": ["Fortaleza 1 con dato real", "Fortaleza 2 con dato real"],
  "weaknesses": ["Debilidad 1 con dato real", "Debilidad 2 con dato real"],
  "opportunities": ["Oportunidad 1 específica y accionable", "Oportunidad 2 específica y accionable"],
  "competitorInsights": [
    {
      "name": "Nombre competidor",
      "verdict": "1 oración sobre qué hace bien o mal este competidor comparado con la empresa"
    }
  ],
  "recommendation": "2-3 oraciones con la recomendación estratégica principal, mencionando cómo Employee Advocacy (Adpro) puede cerrar brechas identificadas"
}

Sé específico con los datos. Usa cifras reales de engagement rate, frecuencia de publicación, y tamaño de audiencia para fundamentar cada punto.`;

    const companyLine = `EMPRESA: ${data.company.name}
- Seguidores: ${data.company.followers.toLocaleString('es')}
- Empleados: ${data.company.employeeCount.toLocaleString('es')}
- Industria: ${data.company.industry}
- Engagement Rate: ${data.company.engagement.engagementRate}%
- Likes promedio/post: ${data.company.engagement.avgLikes}
- Comentarios promedio/post: ${data.company.engagement.avgComments}
- Publicaciones/mes: ${data.company.engagement.postsPerMonth}`;

    const competitorLines = data.competitors.map((c) =>
      `COMPETIDOR: ${c.name}
- Seguidores: ${c.followers.toLocaleString('es')}
- Empleados: ${c.employeeCount.toLocaleString('es')}
- Industria: ${c.industry}
- Engagement Rate: ${c.engagement.engagementRate}%
- Likes promedio/post: ${c.engagement.avgLikes}
- Comentarios promedio/post: ${c.engagement.avgComments}
- Publicaciones/mes: ${c.engagement.postsPerMonth}`).join('\n\n');

    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${companyLine}\n\n${competitorLines}\n\nGenera la evaluación competitiva en español.` },
      ],
      max_tokens: 1200,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    return JSON.parse(content);
  }

  /**
   * Genera un análisis comercial de una propuesta para vender Adpro
   */
  async analyzeProposal(proposal: {
    company?: { name?: string; industry?: string; employeeCount?: number };
    projections?: Array<{
      platform: string;
      followers?: number;
      growthFactor?: number;
      projectedLikes?: number;
      ambassadorCount?: number;
      ambassadorFollowers?: number;
      potentialReach?: number;
      classification?: string;
    }>;
  }): Promise<Record<string, unknown>> {
    const ORGANIC_REACH: Record<string, number> = {
      linkedin: 0.10, instagram: 0.08, facebook: 0.03, twitter: 0.08, tiktok: 0.25,
    };

    const platformsData = (proposal.projections ?? []).map((p) => {
      const potentialReach = p.potentialReach ?? ((p.followers ?? 0) + (p.ambassadorFollowers ?? 0));
      const impressionsWith = Math.round(potentialReach * (ORGANIC_REACH[p.platform] ?? 0.08));
      const estimatedReactions = Math.round((p.projectedLikes ?? 0) * 1.2);
      return { ...p, impressionsWith, estimatedReactions };
    });

    const systemPrompt = `Eres un consultor senior de ventas de Adpro (AdvocatesPro), la plataforma de Employee Advocacy líder en Latinoamérica. Adpro activa a los empleados como embajadores de marca en sus redes personales, amplificando el alcance orgánico de forma auténtica y medible.

Tu misión: analizar las métricas reales de redes sociales de la empresa y generar un análisis comercial persuasivo y específico que justifique la contratación de Adpro.

Responde ÚNICAMENTE con JSON válido (sin markdown) con esta estructura exacta:
{
  "summary": "2-3 oraciones ejecutivas que capturen la oportunidad concreta de esta empresa con datos reales",
  "platformInsights": [
    {
      "platform": "nombre_plataforma",
      "insight": "Situación actual en esta plataforma (1-2 oraciones con datos reales)",
      "opportunity": "Lo que Adpro puede lograr específicamente aquí (1-2 oraciones con proyecciones)"
    }
  ],
  "keyBenefits": [
    "Beneficio 1 con cifra estimada específica para esta empresa",
    "Beneficio 2 con cifra estimada específica para esta empresa",
    "Beneficio 3 con cifra estimada específica para esta empresa"
  ],
  "callToAction": "Frase de cierre poderosa y personalizada que invite a agendar una demo de Adpro"
}`;

    const userPrompt = `Empresa: ${proposal.company?.name ?? 'Sin nombre'}
Industria: ${proposal.company?.industry || 'No especificada'}
Empleados en LinkedIn: ${proposal.company?.employeeCount ?? 0}

Datos por plataforma:
${platformsData.map((p) => `PLATAFORMA: ${p.platform.toUpperCase()}
- Seguidores actuales: ${(p.followers ?? 0).toLocaleString('es')}
- Embajadores potenciales: ${p.ambassadorCount ?? 0}
- Factor de crecimiento con Adpro: ${(p.growthFactor ?? 1).toFixed(1)}x
- Clasificación de oportunidad: ${p.classification ?? 'LOW'}
- Impresiones estimadas con Adpro: ${p.impressionsWith.toLocaleString('es')}
- Reacciones estimadas: ${p.estimatedReactions.toLocaleString('es')}
- Likes proyectados: ${(p.projectedLikes ?? 0).toLocaleString('es')}`).join('\n\n')}

Genera el análisis en español, siendo específico y persuasivo con los datos reales.`;

    const model = this.configService.get<string>('openai.model') || 'gpt-4o-mini';
    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    return JSON.parse(content);
  }
}
