import {
  baseProfile, compactForLlm, contextFor, detectTopics, outfitSummary, searchGarments, toBool, toNumber, topicSection, trimHistory,
} from './assistant.context';
import { CompletionAccumulator, parseToolArguments, takeSseEvents } from './llm.protocol';
import { LlmService } from './llm.service';
import { systemPrompt, UserStyleContext } from './assistant.prompts';
import type { Garment } from '../outfits/outfit.engine';

const ctx: UserStyleContext = {
  season: 'Invierno frío',
  undertone: 'frío',
  contrast: 'alto',
  skinTone: 'clara',
  faceShape: 'Ovalado',
  bodyType: 'Reloj de arena',
  paletteNames: ['Azul marino', 'Fucsia', 'Blanco óptico', 'Negro', 'Esmeralda', 'Rojo cereza', 'Gris perla'],
  avoidColors: ['Mostaza', 'Naranja'],
  haircuts: ['Bob largo', 'Capas suaves'],
  hairTexture: 'Ondulado',
  makeup: ['Labial frambuesa'],
  garmentCuts: ['Cintura marcada', 'Escote en V'],
  dnaTop: ['Elegancia (78)', 'Minimalismo (70)'],
  preferredStyles: ['minimalista'],
  declaredAvoid: ['beige'],
  occasions: ['oficina'],
  budget: 80,
  wardrobe: { total: 3, byCategory: { superior: 2, inferior: 1 }, sample: [] },
};

const garment = (over: Partial<Garment>): Garment => ({
  id: 'x', name: null, category: 'superior', subcategory: 'blusas', color: null, colorHex: null, season: null, occasion: null,
  wearCount: 0, lastWornAt: null, imageUrl: 'https://firma/secreta', ...over,
});

describe('Asistente con Kimi: solo los datos que la pregunta necesita', () => {
  describe('temas de la pregunta', () => {
    it('detecta temas sin depender de tildes', () => {
      expect(detectTopics('¿Qué colores van con mi estación?')).toEqual(['colores']);
      expect(detectTopics('Qué me pongo para una entrevista')).toEqual(['outfit']);
      expect(detectTopics('qué corte de pelo me favorece')).toEqual(expect.arrayContaining(['cabello']));
      expect(detectTopics('Hola')).toEqual([]);
    });

    it('una continuación sin tema hereda el del mensaje anterior', () => {
      expect(detectTopics('¿y para la noche?', ['Qué me pongo para una boda'])).toEqual(['outfit']);
    });
  });

  describe('contexto', () => {
    it('el resumen fijo es corto y siempre lleva los colores que no quiere', () => {
      const base = baseProfile(ctx, new Date('2026-11-18T12:00:00Z'));
      expect(base).toContain('NO quiere usar');
      expect(base).toContain('beige');
      // Solo 5 colores de la paleta en el resumen, no la paleta entera
      expect(base).not.toContain('Gris perla');
      // No se mandan rostro ni silueta si la pregunta no va de eso
      expect(base).not.toContain('Ovalado');
      expect(base.length).toBeLessThan(600);
    });

    it('añade solo las secciones de los temas detectados', () => {
      const colores = contextFor(['colores'], ctx);
      expect(colores).toContain('Gris perla');
      expect(colores).not.toContain('Bob largo');
      expect(contextFor([], ctx)).toBe('');
    });

    it('dice qué datos faltan en lugar de inventarlos', () => {
      const empty: UserStyleContext = { wardrobe: { total: 0, byCategory: {}, sample: [] } };
      expect(baseProfile(empty)).toMatch(/Aún no tiene: diagnóstico de color, análisis del rostro, análisis de silueta, prendas en el armario/);
      expect(topicSection('silueta', empty)).toBeNull();
    });

    it('el prompt con herramientas las describe; sin ellas, no', () => {
      expect(systemPrompt(ctx, { tools: true })).toContain('buscar_prendas');
      expect(systemPrompt(ctx)).not.toContain('buscar_prendas');
      expect(systemPrompt(ctx, { topics: ['silueta'] })).toContain('Cintura marcada');
    });
  });

  describe('lo que el backend sirve al modelo', () => {
    const closet = [
      garment({ name: 'Blazer negro', subcategory: 'blazers', color: 'Negro', wearCount: 5, occasion: 'trabajo' }),
      garment({ name: 'Blusa floral', color: 'Rosa', pattern: 'floral', wearCount: 1 }),
      garment({ name: 'Pantalón sastre', category: 'inferior', subcategory: 'pantalones', color: 'Negro', wearCount: 3 }),
    ];

    it('busca prendas con filtros y sin ids ni fotos', () => {
      const r = searchGarments(closet, { color: 'negro' });
      expect(r.coincidencias).toBe(2);
      expect(r.prendas.map((p) => p.nombre)).toEqual(['Blazer negro', 'Pantalón sastre']);
      expect(JSON.stringify(r)).not.toMatch(/firma|"id"/);
      expect(searchGarments(closet, { texto: 'floral' }).prendas[0].estampado).toBe('floral');
      expect(searchGarments(closet, { categoria: 'calzado' }).nota).toMatch(/Ninguna/);
      expect(searchGarments(closet, { limite: 1 }).prendas).toHaveLength(1);
    });

    it('un filtro de más del modelo no le hace negar una prenda que existe (caso real: «¿tengo algo gris?»)', () => {
      const withGrey = [...closet, garment({ name: 'Camiseta básica gris', subcategory: 'camisetas', color: 'Gris', occasion: 'casual' })];
      // El modelo añadió ocasión «oficina» por su cuenta
      const r = searchGarments(withGrey, { color: 'gris', categoria: 'superior', ocasion: 'oficina' });
      expect(r.prendas.map((p) => p.nombre)).toEqual(['Camiseta básica gris']);
      expect(r.nota).toMatch(/se quitó: ocasion/);
      // Color y categoría se respetan siempre
      expect(searchGarments(withGrey, { color: 'gris', categoria: 'calzado' }).coincidencias).toBe(0);
    });

    it('acepta números y booleanos que el modelo manda como texto (caso real: lluvia «True»)', () => {
      expect(toBool('True')).toBe(true);
      expect(toBool('sí')).toBe(true);
      expect(toBool('false')).toBe(false);
      expect(toBool('quizá')).toBeUndefined();
      expect(toNumber('3')).toBe(3);
      expect(toNumber('')).toBeUndefined();
      expect(searchGarments(closet, { limite: '1' }).prendas).toHaveLength(1);
    });

    it('resume una propuesta del motor de outfits', () => {
      const s = outfitSummary({
        id: 'o1', title: 'Oficina elegante', score: 0.873, dna: { elegancia: 80 },
        items: [{ role: 'superior', name: 'Blazer negro', color: 'Negro', imageUrl: 'x' }],
        explanation: ['Color de tu paleta', 'Apto para oficina', 'Muy usado', 'extra'], missing: [{ role: 'abrigo', suggestion: 'Una chaqueta ligera' }],
      });
      expect(s).toEqual({
        titulo: 'Oficina elegante', puntuacion: 87, prendas: ['superior: Blazer negro (Negro)'], por_que: ['Color de tu paleta', 'Apto para oficina', 'Muy usado'],
        sugerencia_para_completar: ['abrigo: Una chaqueta ligera'],
      });
    });

    it('recorta el historial y lo empieza por la usuaria', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: 'x'.repeat(i === 19 ? 2000 : 100) }));
      const h = trimHistory(rows);
      expect(h.length).toBeLessThanOrEqual(8);
      expect(h[0].role).toBe('user');
      expect(h.every((m) => m.content.length <= 601)).toBe(true);
    });

    it('quita ids, URLs, fechas y vectores de lo que se explica', () => {
      const c = compactForLlm({ id: '1', userId: '2', imageUrl: 'u', createdAt: 'd', dna: { a: 1 }, score: 0.87654, title: 't', items: [1, 2, 3, 4, 5, 6, 7, 8] });
      expect(c).toEqual({ score: 0.88, title: 't', items: [1, 2, 3, 4, 5, 6] });
    });
  });

  describe('protocolo compatible con OpenAI', () => {
    it('junta llamadas a herramientas que llegan troceadas en el stream', () => {
      const acc = new CompletionAccumulator();
      acc.push({ choices: [{ delta: { reasoning_content: 'pienso' } }] });
      acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'buscar_prendas', arguments: '{"co' } }] } }] });
      acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'lor":"negro"}' } }] }, finish_reason: 'tool_calls' }] });
      const r = acc.result();
      expect(r.reasoning).toBe('pienso');
      expect(r.toolCalls).toEqual([{ id: 'c1', type: 'function', function: { name: 'buscar_prendas', arguments: '{"color":"negro"}' } }]);
      expect(parseToolArguments(r.toolCalls[0].function.arguments)).toEqual({ color: 'negro' });
    });

    it('lee eventos SSE y guarda la línea a medias', () => {
      const { events, rest } = takeSseEvents('data: {"a":1}\n\ndata: [DONE]\ndata: {"b"');
      expect(events).toEqual(['{"a":1}']);
      expect(rest).toBe('data: {"b"');
      expect(parseToolArguments('no es json')).toEqual({});
    });
  });

  describe('LlmService con Kimi (API simulada)', () => {
    const settings = (values: Record<string, unknown>) => ({
      get: async (k: string) => values[k],
      getBoolean: async (k: string) => values[k] !== false,
    });
    const cache = { get: async () => undefined, set: async () => undefined };
    const config = (env: Record<string, string>) => ({ get: (k: string) => env[k] });
    const kimiSettings = { llm_provider: 'kimi', kimi_model: 'kimi-k3.1-pro', kimi_reasoning_effort: 'low', llm_model: 'llama3.1:8b', llm_enabled: true };
    const realFetch = global.fetch;
    let bodies: any[] = [];

    const respond = (...replies: any[]) => {
      bodies = [];
      let i = 0;
      global.fetch = jest.fn(async (_url: any, init: any) => {
        bodies.push(JSON.parse(init.body));
        const reply = replies[Math.min(i++, replies.length - 1)];
        return { ok: true, status: 200, json: async () => reply, text: async () => JSON.stringify(reply) } as any;
      }) as any;
    };
    afterEach(() => { global.fetch = realFetch; });

    const service = (env = { KIMI_API_KEY: 'clave' }, values = kimiSettings) => new LlmService(config(env) as any, settings(values) as any, cache as any);

    it('pide datos con herramientas, devuelve el razonamiento a Kimi y no envía temperatura a K3', async () => {
      respond(
        { choices: [{ message: { content: '', reasoning_content: 'necesito su armario', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'buscar_prendas', arguments: '{"color":"negro"}' } }] }, finish_reason: 'tool_calls' }] },
        { choices: [{ message: { content: 'Ponte tu Blazer negro.' }, finish_reason: 'stop' }] },
      );
      const execute = jest.fn(async () => ({ prendas: [{ nombre: 'Blazer negro' }] }));
      const r = await service().converse([{ role: 'user', content: 'qué me pongo' }], { tools: [{ type: 'function', function: { name: 'buscar_prendas', description: '', parameters: { type: 'object' } } }], execute });

      expect(r).toEqual({ content: 'Ponte tu Blazer negro.', provider: 'kimi', model: 'kimi-k3.1-pro', toolsUsed: ['buscar_prendas'] });
      expect(execute).toHaveBeenCalledWith('buscar_prendas', { color: 'negro' });
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://api.moonshot.ai/v1/chat/completions');
      expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBe('Bearer clave');
      expect(bodies[0].temperature).toBeUndefined();
      expect(bodies[0].reasoning_effort).toBe('low');
      // Segunda ronda: el mensaje del asistente vuelve con su razonamiento y el resultado de la herramienta
      const assistantTurn = bodies[1].messages.find((m: any) => m.role === 'assistant');
      expect(assistantTurn.reasoning_content).toBe('necesito su armario');
      expect(bodies[1].messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1', name: 'buscar_prendas' });
    });

    it('tras 3 rondas de herramientas exige la respuesta (sin ofrecerlas)', async () => {
      const toolTurn = { choices: [{ message: { content: '', tool_calls: [{ id: 'c', type: 'function', function: { name: 'consultar_perfil', arguments: '{"seccion":"colores"}' } }] }, finish_reason: 'tool_calls' }] };
      respond(toolTurn, toolTurn, toolTurn, { choices: [{ message: { content: 'Listo.' }, finish_reason: 'stop' }] });
      const r = await service().converse([{ role: 'user', content: 'x' }], { tools: [{ type: 'function', function: { name: 'consultar_perfil', description: '', parameters: { type: 'object' } } }], execute: async () => ({}) });
      expect(r?.content).toBe('Listo.');
      expect(bodies).toHaveLength(4);
      expect(bodies[3].tools).toBeUndefined();
    });

    it('sin clave de Kimi usa Ollama local (con temperatura y sin razonamiento)', async () => {
      respond({ choices: [{ message: { content: 'Hola' }, finish_reason: 'stop' }] });
      const r = await service({} as any).converse([{ role: 'user', content: 'hola' }]);
      expect(r?.provider).toBe('ollama');
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions');
      expect(bodies[0].temperature).toBe(0.4);
      expect(bodies[0].reasoning_effort).toBeUndefined();
    });

    it('si la API falla devuelve null y el asistente pasa a reglas', async () => {
      global.fetch = jest.fn(async () => ({ ok: false, status: 401, text: async () => '{"error":{"message":"Invalid Authentication"}}' })) as any;
      expect(await service().converse([{ role: 'user', content: 'hola' }])).toBeNull();
    });
  });
});
