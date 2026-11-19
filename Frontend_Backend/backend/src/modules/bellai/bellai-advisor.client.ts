import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserBeautyContext, BellaiContextBuilder } from './bellai-context.builder';

export interface AdvisorReply {
  content: string;
  provider: string;
}

@Injectable()
export class BellaiAdvisorClient {
  private readonly unavailableMessage =
    'El servicio de la asesora virtual no está disponible en este momento. Inténtalo nuevamente en unos minutos.';

  constructor(
    private readonly config: ConfigService,
    private readonly contextBuilder: BellaiContextBuilder,
  ) {}

  async generateReply(
    userMessage: string,
    context: UserBeautyContext,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<AdvisorReply> {
    if (this.config.get<string>('BELLAI_ADVISOR_DISABLED') === 'true') {
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    const geminiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    const openAiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    const customAiUrl = this.config.get<string>('BELLAI_AI_CHAT_URL')?.trim();

    const systemPrompt = this.buildSystemPrompt(context);

    try {
      if (geminiKey) {
        return await this.callGemini(geminiKey, systemPrompt, history, userMessage);
      }
      if (openAiKey) {
        return await this.callOpenAi(openAiKey, systemPrompt, history, userMessage);
      }
      if (customAiUrl) {
        return await this.callCustomEndpoint(customAiUrl, systemPrompt, history, userMessage);
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    return {
      content: this.buildContextualExpertReply(userMessage, context),
      provider: 'bellai-expert-engine',
    };
  }

  private buildContextualExpertReply(
    rawInput: string,
    ctx: UserBeautyContext,
  ): string {
    const cleanQuestion = rawInput.split('\n\n[Contexto de la usuaria:')[0].trim();
    const q = cleanQuestion.toLowerCase();

    const season = ctx.diagnostic?.seasonalPalette || this.extractFromInline(rawInput, /estaci[oó]n ([^,.]+)/i) || 'tu paleta personal';
    const undertone = ctx.diagnostic?.undertone || this.extractFromInline(rawInput, /subtono ([^,.]+)/i) || 'natural';
    const faceShape = ctx.diagnostic?.faceShape || this.extractFromInline(rawInput, /rostro ([^,.]+)/i) || 'armonioso';
    const skinTone = ctx.diagnostic?.skinTone || this.extractFromInline(rawInput, /tono de piel ([^,.]+)/i) || 'tu piel';

    const styles =
      ctx.preferences.preferredStyles.length > 0
        ? ctx.preferences.preferredStyles.join(' y ')
        : this.extractFromInline(rawInput, /Estilos preferidos: ([^.]+)/i) || 'tu estilo personal';

    const wardrobeNames =
      ctx.wardrobe.items.length > 0
        ? ctx.wardrobe.items.slice(0, 4).map((i) => `${i.name}${i.color ? ` (${i.color})` : ''}`)
        : [];
    const wardrobeColors =
      ctx.wardrobe.colors.length > 0
        ? ctx.wardrobe.colors.slice(0, 4).join(', ')
        : this.extractFromInline(rawInput, /colores: ([^)]+)/i) || 'tonos neutros y de acento';

    const paletteColors =
      ctx.diagnostic?.recommendedPalette && ctx.diagnostic.recommendedPalette.length > 0
        ? ctx.diagnostic.recommendedPalette.slice(0, 4).join(', ')
        : this.extractFromInline(rawInput, /Paleta ideal: ([^.]+)/i) || wardrobeColors;

    if (q.includes('corte') || q.includes('cabello') || q.includes('pelo') || q.includes('peinado')) {
      return `Hola ${ctx.userName}. Como experta en visagismo y belleza femenina, para tu rostro **${faceShape}** y subtono **${undertone}** (${season}) te recomiendo:\n\n` +
        `• **Corte ideal:** Capas suaves a la altura de la clavícula o un desfilado que enmarque tus pómulos sin endurecer tus facciones.\n` +
        `• **Coloración y reflejos:** Tonos alineados con tu paleta (${paletteColors}) que aportan luminosidad natural a ${skinTone}.\n` +
        `• **Armonía con tu estilo:** Este acabado complementa tu estética **${styles}** y combina con las prendas de tu armario (${wardrobeColors}).`;
    }

    if (q.includes('maquillaje') || q.includes('labial') || q.includes('ojos') || q.includes('rubor') || q.includes('belleza')) {
      return `Hola ${ctx.userName}. Teniendo en cuenta tu estación **${season}**, subtono **${undertone}** y rostro **${faceShape}**, mi recomendación de maquillaje y belleza para ti es:\n\n` +
        `• **Piel y rubor:** Base ligera de acabado satinado que respete tu subtono ${undertone}, aplicando el rubor en diagonal suave para realzar tu rostro ${faceShape}.\n` +
        `• **Labios y mirada:** Elige labiales y sombras dentro de tu gama favorable (${paletteColors}), evitando tonos que apaguen tu luminosidad.\n` +
        `• **Coordinación con tu ropa:** Funcionará en armonía con los colores de tu armario (${wardrobeColors}) y tu estilo **${styles}**.`;
    }

    if (q.includes('color') || q.includes('paleta') || q.includes('favorec') || q.includes('tono')) {
      return `Hola ${ctx.userName}. Según tu diagnóstico de colorimetría (**${season}**, piel **${skinTone}**, subtono **${undertone}**), estos son los colores que más te favorecen:\n\n` +
        `• **Tonos estrella cerca del rostro:** ${paletteColors}. Iluminan tu mirada y suavizan líneas de expresión.\n` +
        `• **En tu armario actual:** Ya cuentas con tonos como **${wardrobeColors}**${wardrobeNames.length ? ` en prendas como ${wardrobeNames.slice(0, 3).join(', ')}` : ''}.\n` +
        `• **Consejo de estilismo:** Usa tus colores más favorecedores en blusas, blazers o accesorios cercanos a tu rostro **${faceShape}** para potenciar tu estilo **${styles}**.`;
    }

    const garmentSuggestion =
      wardrobeNames.length >= 2
        ? `combinar **${wardrobeNames[0]}** con **${wardrobeNames[1]}**${wardrobeNames[2] ? ` y **${wardrobeNames[2]}**` : ''}`
        : `combinar una prenda principal en tus tonos favorables (**${paletteColors}**) con una base neutra en **${wardrobeColors}**`;

    return `Hola ${ctx.userName}. Analizando tu perfil completo de moda y belleza (**${season}**, subtono **${undertone}**, rostro **${faceShape}** y estilo **${styles}**), te recomiendo:\n\n` +
      `• **Propuesta de conjunto:** Te sugiero ${garmentSuggestion}.\n` +
      `• **Equilibrio de color y corte:** Los tonos (${paletteColors}) realzan la luz de tu piel (${skinTone}), mientras que los escotes despejados favorecen tu rostro ${faceShape}.\n` +
      `• **Toque final de belleza:** Acompaña el look con accesorios y maquillaje sutil dentro de tu subtono ${undertone} para mantener la coherencia de tu estilo **${styles}**.`;
  }

  private extractFromInline(text: string, regex: RegExp): string | null {
    const match = text.match(regex);
    return match?.[1]?.trim() || null;
  }

  private buildSystemPrompt(context: UserBeautyContext): string {
    const contextBlock = this.contextBuilder.formatPromptContext(context);
    return [
      'Eres BellAI, asesora personal experta en moda femenina, imagen personal, colorimetría, visagismo, cuidado estético, maquillaje, cabello y combinaciones de armario.',
      'Responde siempre en español claro, cercano, práctico y sin tecnicismos innecesarios.',
      'Usa obligatoriamente la información real de la usuaria que se adjunta abajo (colorimetría, rostro, colores, preferencias, ocasiones y prendas exactas de su armario).',
      'Si la usuaria no tiene aún diagnóstico o prendas registradas, dilo con honestidad y sugiere completar esa sección sin inventar datos.',
      'Incluye brevemente el motivo por el cual recomiendas cada prenda, color o estilo según sus características.',
      '',
      '--- PERFIL REAL DE LA USUARIA ---',
      contextBlock,
    ].join('\n');
  }

  private async callGemini(
    apiKey: string,
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
  ): Promise<AdvisorReply> {
    const model = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const contents = [
      ...history.slice(-10).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.65, maxOutputTokens: 650 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    const data = (await response.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    return { content: text, provider: 'gemini' };
  }

  private async callOpenAi(
    apiKey: string,
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
  ): Promise<AdvisorReply> {
    const model = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        max_tokens: 650,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    const data = (await response.json()) as any;
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    return { content: text, provider: 'openai' };
  }

  private async callCustomEndpoint(
    url: string,
    systemPrompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
  ): Promise<AdvisorReply> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, history: history.slice(-10), message: userMessage }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    const data = (await response.json()) as any;
    const text = (data?.reply || data?.content || data?.answer)?.trim();
    if (!text) {
      throw new ServiceUnavailableException(this.unavailableMessage);
    }

    return { content: text, provider: 'custom-ai' };
  }
}
