/**
 * Protocolo de chat compatible con OpenAI, que hablan tanto Kimi (Moonshot) como Ollama (`/v1`).
 * Funciones puras (sin red) para poder probar el stream y las llamadas a herramientas.
 */

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  /** Kimi K3 siempre razona: en una ronda con herramientas hay que devolverle su razonamiento tal cual */
  reasoning_content?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown>; strict?: boolean };
}

export interface Completion {
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
}

/**
 * Junta los fragmentos de una respuesta (en stream o completa). Las llamadas a herramientas llegan
 * troceadas por `index`: el nombre una vez y los argumentos en varios trozos.
 */
export class CompletionAccumulator {
  private content = '';
  private reasoning = '';
  private finishReason: string | null = null;
  private readonly calls = new Map<number, ToolCall>();

  /** Añade un fragmento (`chunk` de stream o respuesta completa) y devuelve el texto nuevo para la usuaria. */
  push(chunk: any): string {
    const choice = chunk?.choices?.[0];
    if (!choice) return '';
    const part = choice.delta ?? choice.message ?? {};
    if (typeof part.reasoning_content === 'string') this.reasoning += part.reasoning_content;
    let token = '';
    if (typeof part.content === 'string' && part.content) {
      this.content += part.content;
      token = part.content;
    }
    (Array.isArray(part.tool_calls) ? part.tool_calls : []).forEach((tc: any, pos: number) => {
      const index = typeof tc.index === 'number' ? tc.index : pos;
      const call = this.calls.get(index) ?? { id: '', type: 'function' as const, function: { name: '', arguments: '' } };
      if (tc.id) call.id = tc.id;
      if (tc.function?.name && !call.function.name) call.function.name = tc.function.name;
      const args = tc.function?.arguments;
      if (args !== undefined && args !== null) call.function.arguments += typeof args === 'string' ? args : JSON.stringify(args);
      this.calls.set(index, call);
    });
    if (choice.finish_reason) this.finishReason = choice.finish_reason;
    return token;
  }

  result(): Completion {
    const toolCalls = [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, c], i) => ({ ...c, id: c.id || `llamada_${i}` }))
      .filter((c) => c.function.name);
    return { content: this.content, reasoning: this.reasoning, toolCalls, finishReason: this.finishReason };
  }
}

/** Separa del buffer los eventos SSE completos (`data: …`); devuelve sus cargas y el resto sin terminar. */
export function takeSseEvents(buffer: string): { events: string[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events = lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter((l) => l && l !== '[DONE]');
  return { events, rest };
}

/** Argumentos de una herramienta: JSON del modelo, que a veces llega vacío o mal formado. */
export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Mensaje de error legible de una respuesta de la API (`{ error: { message } }` en Kimi y OpenAI). */
export function apiErrorMessage(status: number, body: string): string {
  try {
    const j = JSON.parse(body);
    const msg = j?.error?.message || j?.message || j?.error;
    if (typeof msg === 'string' && msg) return `HTTP ${status}: ${msg.slice(0, 200)}`;
  } catch {
    // cuerpo no JSON
  }
  return `HTTP ${status}: ${body.slice(0, 200)}`;
}
