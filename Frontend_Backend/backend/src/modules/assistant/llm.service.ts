import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PlatformSettingsService } from '../admin/settings/settings.service';
import {
  apiErrorMessage, ChatMessage, Completion, CompletionAccumulator, parseToolArguments, takeSseEvents, ToolDefinition,
} from './llm.protocol';

export type { ChatMessage, ToolDefinition } from './llm.protocol';

export type LlmProviderName = 'kimi' | 'ollama';

interface ProviderConfig {
  name: LlmProviderName;
  label: string;
  /** Raíz compatible con OpenAI (termina en /v1) */
  baseUrl: string;
  apiKey: string | null;
  model: string;
  /** Los K3 tienen la temperatura fija en 1 y rechazan que se envíe */
  sendTemperature: boolean;
  extraBody: Record<string, unknown>;
  /** Kimi exige recibir de vuelta su razonamiento en las rondas con herramientas */
  keepReasoning: boolean;
}

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface ConverseResult {
  content: string;
  provider: LlmProviderName;
  model: string;
  toolsUsed: string[];
}

/** Rondas de herramientas antes de exigir la respuesta final. */
const MAX_TOOL_ROUNDS = 3;
/** Llamadas por ronda: evita que el modelo pida todo a la vez. */
const MAX_CALLS_PER_ROUND = 4;
/** Tope de cada resultado de herramienta que vuelve al modelo. */
const MAX_TOOL_RESULT_CHARS = 3500;

/**
 * HU-026 / HU-042: modelo de lenguaje del asistente.
 * - `kimi`: API de Kimi (Moonshot), con la clave `KIMI_API_KEY` del servidor.
 * - `ollama`: modelo local; también es el respaldo si falta la clave de Kimi.
 * Ambos se hablan por el protocolo compatible con OpenAI, con llamadas a herramientas para que
 * el modelo pida al backend solo los datos que necesita (ver assistant.context.ts).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly ollamaUrl: string;
  private readonly kimiUrl: string;
  private readonly kimiKey: string | null;

  constructor(
    config: ConfigService,
    private readonly settings: PlatformSettingsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.ollamaUrl = (config.get<string>('OLLAMA_URL') || 'http://localhost:11434').replace(/\/$/, '');
    this.kimiUrl = (config.get<string>('KIMI_BASE_URL') || 'https://api.moonshot.ai/v1').replace(/\/$/, '');
    this.kimiKey = config.get<string>('KIMI_API_KEY')?.trim() || config.get<string>('MOONSHOT_API_KEY')?.trim() || null;
  }

  async enabled(): Promise<boolean> {
    return this.settings.getBoolean('llm_enabled');
  }

  /** Proveedor que de verdad se usa ahora (Kimi sin clave cae a Ollama). */
  private async provider(): Promise<ProviderConfig & { requested: LlmProviderName }> {
    const requested = (String(await this.settings.get('llm_provider')) as LlmProviderName) || 'kimi';
    if (requested === 'kimi' && this.kimiKey) {
      const model = String(await this.settings.get('kimi_model'));
      const k3 = /^kimi-k3/i.test(model);
      return {
        requested, name: 'kimi', label: 'Kimi (Moonshot)', baseUrl: this.kimiUrl, apiKey: this.kimiKey, model,
        sendTemperature: !k3,
        extraBody: k3 ? { reasoning_effort: String(await this.settings.get('kimi_reasoning_effort')) } : {},
        keepReasoning: true,
      };
    }
    return {
      requested, name: 'ollama', label: 'Ollama', baseUrl: `${this.ollamaUrl}/v1`, apiKey: null,
      model: String(await this.settings.get('llm_model')), sendTemperature: true, extraBody: {}, keepReasoning: false,
    };
  }

  async model(): Promise<string> {
    return (await this.provider()).model;
  }

  async status() {
    const p = await this.provider();
    const enabled = await this.enabled();
    const base = { enabled, model: p.model, provider: p.name, providerLabel: p.label };
    // Pidió Kimi pero no hay clave: se usa Ollama y se avisa
    const notice = p.requested === 'kimi' && p.name !== 'kimi' ? 'Falta KIMI_API_KEY en el servidor: se usa el modelo local.' : null;
    if (p.name === 'kimi') {
      try {
        const res = await fetch(`${p.baseUrl}/models`, { headers: { Authorization: `Bearer ${p.apiKey}` }, signal: AbortSignal.timeout(4000) });
        if (res.status === 401 || res.status === 403) return { ...base, online: true, modelInstalled: false, installed: [], problem: 'La clave de Kimi no es válida o no tiene saldo.' };
        // Sin listado de modelos no se puede comprobar el nombre: se da por bueno
        if (!res.ok) return { ...base, online: true, modelInstalled: true, installed: [], problem: null };
        const ids: string[] = ((await res.json()) as any)?.data?.map((m: any) => m.id) ?? [];
        return { ...base, online: true, modelInstalled: !ids.length || ids.includes(p.model), installed: ids, problem: null };
      } catch {
        return { ...base, online: false, modelInstalled: false, installed: [], problem: null };
      }
    }
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
      const data: any = await res.json();
      const installed: string[] = (data.models || []).map((m: any) => m.name);
      return { ...base, online: true, modelInstalled: installed.some((n) => n === p.model || n.startsWith(`${p.model}:`)), installed, problem: notice };
    } catch {
      return { ...base, online: false, modelInstalled: false, installed: [], problem: notice };
    }
  }

  /** Una llamada al modelo. Con `onToken` va en stream y entrega el texto a medida que llega. */
  private async complete(
    p: ProviderConfig,
    messages: ChatMessage[],
    opts: { tools?: ToolDefinition[]; temperature?: number; onToken?: (t: string) => void; signal?: AbortSignal; timeoutMs?: number },
  ): Promise<Completion> {
    const body: Record<string, unknown> = {
      model: p.model,
      // El razonamiento solo se devuelve a quien lo pide (Kimi); a Ollama no le sirve
      messages: messages.map((m) => (p.keepReasoning || !m.reasoning_content ? m : { ...m, reasoning_content: undefined })),
      stream: Boolean(opts.onToken),
      ...p.extraBody,
    };
    if (p.sendTemperature) body.temperature = opts.temperature ?? 0.4;
    if (opts.tools?.length) body.tools = opts.tools;
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}) },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    });
    if (!res.ok) throw Object.assign(new Error(apiErrorMessage(res.status, await res.text())), { status: res.status });
    const acc = new CompletionAccumulator();
    if (!opts.onToken) {
      acc.push(await res.json());
      return acc.result();
    }
    if (!res.body) throw new Error('Respuesta sin cuerpo');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = takeSseEvents(buffer);
      buffer = rest;
      for (const e of events) {
        const token = acc.push(JSON.parse(e));
        if (token) opts.onToken(token);
      }
    }
    for (const e of takeSseEvents(buffer + '\n').events) {
      const token = acc.push(JSON.parse(e));
      if (token) opts.onToken(token);
    }
    return acc.result();
  }

  /**
   * Conversación con herramientas: el modelo pide datos (`tool_calls`), el backend los sirve
   * y se repite hasta que responde. Devuelve null si el modelo está desactivado o no responde.
   */
  async converse(
    messages: ChatMessage[],
    opts: { tools?: ToolDefinition[]; execute?: ToolExecutor; onToken?: (t: string) => void; signal?: AbortSignal; temperature?: number } = {},
  ): Promise<ConverseResult | null> {
    if (!(await this.enabled())) return null;
    const p = await this.provider();
    const history = [...messages];
    const toolsUsed: string[] = [];
    let tools = opts.execute ? opts.tools : undefined;
    try {
      for (let round = 0; ; round++) {
        // En la última ronda no se ofrecen herramientas: tiene que responder con lo que ya tiene
        const offer = tools?.length && round < MAX_TOOL_ROUNDS ? tools : undefined;
        let r: Completion;
        try {
          r = await this.complete(p, history, { tools: offer, onToken: opts.onToken, signal: opts.signal, temperature: opts.temperature });
        } catch (err: any) {
          // Modelos locales sin soporte de herramientas: se repite sin ellas
          if (offer && err?.status === 400 && /tool/i.test(err.message)) {
            this.logger.warn(`${p.model} no admite herramientas; se responde sin ellas.`);
            tools = undefined;
            round--;
            continue;
          }
          throw err;
        }
        if (offer && r.toolCalls.length) {
          const calls = r.toolCalls.slice(0, MAX_CALLS_PER_ROUND);
          history.push({ role: 'assistant', content: r.content, tool_calls: calls, ...(p.keepReasoning && r.reasoning ? { reasoning_content: r.reasoning } : {}) });
          for (const call of calls) {
            toolsUsed.push(call.function.name);
            this.logger.debug(`${p.label} pidió ${call.function.name}(${call.function.arguments || "{}"})`);
            let result: unknown;
            try {
              result = await opts.execute!(call.function.name, parseToolArguments(call.function.arguments));
            } catch (err: any) {
              result = { error: `No se pudo obtener: ${err?.message ?? 'error desconocido'}` };
            }
            history.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result).slice(0, MAX_TOOL_RESULT_CHARS) });
          }
          continue;
        }
        const content = r.content.trim();
        if (!content) return null;
        return { content, provider: p.name, model: p.model, toolsUsed };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' && opts.signal?.aborted) return null;
      this.logger.warn(`Modelo de lenguaje no disponible (${p.label} · ${p.model}): ${err?.message}`);
      return null;
    }
  }

  private cacheKey(model: string, messages: ChatMessage[]) {
    return 'llm:' + createHash('sha256').update(model + JSON.stringify(messages)).digest('hex');
  }

  /** Respuesta completa sin herramientas (explicaciones), cacheada por prompt. */
  async chat(messages: ChatMessage[], opts: { temperature?: number; useCache?: boolean } = {}): Promise<ConverseResult | null> {
    if (!(await this.enabled())) return null;
    const model = await this.model();
    const key = this.cacheKey(model, messages);
    if (opts.useCache !== false) {
      const hit = await this.cache.get<ConverseResult>(key);
      if (hit?.content) return hit;
    }
    const r = await this.converse(messages, { temperature: opts.temperature });
    if (r && opts.useCache !== false) await this.cache.set(key, r, 60 * 60 * 1000);
    return r;
  }
}
