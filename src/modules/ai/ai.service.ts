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
      console.error('⚠️  OPENAI_API_KEY no configurada en variables de entorno');
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    console.log('✅ OpenAI client initialized successfully');
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
      throw new UnauthorizedException('Usuario no encontrado');
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
      console.error('Error en AI service:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: 500,
          message: 'AI_ERROR',
          error: error.message || 'Error al procesar tu mensaje',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
