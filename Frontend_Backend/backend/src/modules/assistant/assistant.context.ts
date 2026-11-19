/**
 * Qué datos recibe el modelo en cada pregunta. En lugar de mandar siempre el perfil entero y
 * medio armario, se envía:
 * 1. un resumen fijo y corto (lo imprescindible para no equivocarse: estación, colores a evitar…);
 * 2. solo las secciones del perfil que tocan el tema de la pregunta;
 * 3. herramientas para que el modelo pida al backend el resto, si de verdad lo necesita.
 * Todo son funciones puras para poder probarlas sin modelo.
 */
import type { Garment } from '../outfits/outfit.engine';
import type { UserStyleContext } from './assistant.prompts';
import type { ChatMessage, ToolDefinition } from './llm.protocol';

export type Topic = 'colores' | 'cabello' | 'maquillaje' | 'rostro' | 'silueta' | 'outfit' | 'compras' | 'estilo';

/** Minúsculas y sin tildes, para que «estación» y «estacion» coincidan. */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const TOPIC_PATTERNS: Record<Topic, RegExp> = {
  colores: /\b(colou?r\w*|paleta|tonos?|estacion|subtono|contraste|neutros?|combina con)\b/,
  cabello: /\b(cabello|pelo|cortes?|peinad\w*|flequillo|melena|tinte|mechas|rizos?|ondas|lacio|calvicie)\b/,
  maquillaje: /\b(maquill\w*|labial|labios|sombras?|base|rubor|colorete|delineado|rimel|pestanas|cejas|iluminador)\b/,
  rostro: /\b(rostro|cara|facciones|gafas|lentes|anteojos|aretes|pendientes|aros|pomulos|mandibula|frente)\b/,
  silueta: /\b(silueta|cuerpo|figura|cintura|caderas?|hombros|piernas|busto|talla|estiliz\w*|alarga\w*|proporcion\w*|bajita|alta)\b/,
  outfit: /\b(outfits?|looks?|pongo|ponerme|ponga|vestir(me)?|visto|llevar|combin\w*|conjuntos?|evento|boda|entrevista|cita|fiesta|oficina|trabajo|reunion|viaje|playa|graduacion|cena|armario|ropa|prendas?)\b/,
  compras: /\b(compr\w*|tienda|invertir|presupuesto|gastar|precio|vale la pena|me falta)\b/,
  estilo: /\b(estilos?|style dna|aesthetic|vibe|elegante|minimalista|romantic\w*|clasic\w*|boho|perfil|me define|mi esencia)\b/,
};

/**
 * Temas de la pregunta. Si es una continuación sin tema propio («¿y para la noche?»), hereda los
 * del último mensaje de la usuaria que sí tenía tema.
 */
export function detectTopics(question: string, previousUserMessages: string[] = []): Topic[] {
  const find = (t: string) => (Object.keys(TOPIC_PATTERNS) as Topic[]).filter((k) => TOPIC_PATTERNS[k].test(normalize(t)));
  const own = find(question);
  if (own.length) return own;
  for (const prev of [...previousUserMessages].reverse()) {
    const inherited = find(prev);
    if (inherited.length) return inherited;
  }
  return [];
}

const list = (xs: (string | null | undefined)[] | undefined, n: number) => (xs ?? []).filter(Boolean).slice(0, n).join(', ');

/** Resumen que va siempre: corto y con lo que evita errores graves (colores a evitar, datos que faltan). */
export function baseProfile(c: UserStyleContext, today = new Date()): string {
  const lines = [`- Fecha de hoy: ${today.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`];
  lines.push(
    c.season
      ? `- Colorimetría: ${c.season}, subtono ${c.undertone ?? 'sin dato'}, contraste ${c.contrast ?? 'sin dato'}. Colores principales: ${list(c.paletteNames, 5) || 'sin dato'}`
      : '- Colorimetría: sin diagnóstico todavía',
  );
  if (c.declaredAvoid?.length) lines.push(`- Colores que NO quiere usar (no los sugieras nunca): ${list(c.declaredAvoid, 8)}`);
  const style = [c.dnaTop?.length ? `perfil ${list(c.dnaTop, 3)}` : '', c.preferredStyles?.length ? `prefiere ${list(c.preferredStyles, 3)}` : ''].filter(Boolean).join('; ');
  if (style) lines.push(`- Estilo: ${style}`);
  if (c.wardrobe) {
    const cats = Object.entries(c.wardrobe.byCategory).map(([k, v]) => `${v} ${k}`).join(', ');
    lines.push(`- Armario: ${c.wardrobe.total ? `${c.wardrobe.total} prendas (${cats})` : 'vacío'}`);
  }
  const missing = [
    !c.season && 'diagnóstico de color',
    !c.faceShape && 'análisis del rostro',
    !c.bodyType && 'análisis de silueta',
    !c.wardrobe?.total && 'prendas en el armario',
  ].filter(Boolean);
  if (missing.length) lines.push(`- Aún no tiene: ${missing.join(', ')}`);
  return lines.join('\n');
}

/** Detalle de un tema concreto. Lo usan tanto el contexto inicial como la herramienta `consultar_perfil`. */
export function topicSection(topic: Topic, c: UserStyleContext): string | null {
  switch (topic) {
    case 'colores':
      if (!c.season) return null;
      return [
        `Paleta completa: ${list(c.paletteNames, 12)}`,
        c.avoidColors?.length ? `Colores que reducen su armonía cerca del rostro: ${list(c.avoidColors, 6)}` : '',
        c.skinTone ? `Piel ${c.skinTone}` : '',
      ].filter(Boolean).join('. ');
    case 'cabello':
      if (!c.faceShape && !c.hairTexture) return null;
      return [
        c.faceShape ? `Rostro ${c.faceShape}; cortes recomendados: ${list(c.haircuts, 4) || 'sin dato'}` : '',
        c.hairTexture ? `Textura del cabello: ${c.hairTexture}` : '',
        c.hairCare?.length ? `Cuidados: ${list(c.hairCare, 3)}` : '',
      ].filter(Boolean).join('. ');
    case 'maquillaje':
      if (!c.makeup?.length && !c.eyes && !c.season) return null;
      return [
        c.eyes ? `Rasgos: ${c.eyes}` : '',
        c.makeup?.length ? `Maquillaje que le favorece: ${list(c.makeup, 4)}` : '',
        c.season ? `Subtono ${c.undertone ?? 'sin dato'} (guía para tonos de base y labial)` : '',
      ].filter(Boolean).join('. ');
    case 'rostro':
      if (!c.faceShape) return null;
      return [`Forma del rostro: ${c.faceShape}`, c.eyes ? `rasgos: ${c.eyes}` : '', c.haircuts?.length ? `cortes que la favorecen: ${list(c.haircuts, 3)}` : ''].filter(Boolean).join('; ');
    case 'silueta':
      if (!c.bodyType) return null;
      return `Silueta ${c.bodyType}; cortes de prenda que la armonizan: ${list(c.garmentCuts, 4) || 'sin dato'}`;
    case 'compras':
      return [c.budget ? `Presupuesto por prenda: ${c.budget}` : 'Sin presupuesto declarado', c.season ? `Colores que le favorecen: ${list(c.paletteNames, 6)}` : ''].filter(Boolean).join('. ');
    case 'estilo':
      return [
        c.dnaTop?.length ? `Style DNA: ${list(c.dnaTop, 3)}` : '',
        c.preferredStyles?.length ? `Estilos declarados: ${list(c.preferredStyles, 5)}` : '',
        c.occasions?.length ? `Ocasiones frecuentes: ${list(c.occasions, 5)}` : '',
      ].filter(Boolean).join('. ') || null;
    case 'outfit':
      return [
        c.occasions?.length ? `Ocasiones frecuentes: ${list(c.occasions, 4)}` : '',
        c.bodyType ? `Silueta ${c.bodyType}` : '',
        c.budget ? `Presupuesto por prenda: ${c.budget}` : '',
      ].filter(Boolean).join('. ') || null;
  }
}

/** Contexto para esta pregunta: resumen fijo + solo las secciones de sus temas. */
export function contextFor(topics: Topic[], c: UserStyleContext): string {
  const sections = topics.map((t) => topicSection(t, c)).filter(Boolean);
  return sections.length ? sections.map((s) => `- ${s}`).join('\n') : '';
}

export const PROFILE_SECTIONS = ['colores', 'rostro', 'cabello', 'maquillaje', 'silueta', 'estilo'] as const;
export const GARMENT_CATEGORIES = ['superior', 'inferior', 'calzado', 'abrigo', 'accesorio'] as const;

/** Herramientas que se ofrecen al modelo. Esquemas simples para que Kimi y los modelos locales los entiendan. */
export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'consultar_perfil',
      description: 'Devuelve el detalle de una parte del perfil de la usuaria que no esté ya en el contexto.',
      parameters: {
        type: 'object',
        properties: { seccion: { type: 'string', enum: [...PROFILE_SECTIONS], description: 'Parte del perfil que necesitas.' } },
        required: ['seccion'],
      },
      strict: false,
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_prendas',
      description: 'Busca prendas confirmadas de su armario, las más usadas primero. Pon solo los filtros que pide la pregunta (no añadas ocasión ni categoría si la usuaria no las menciona).',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', enum: [...GARMENT_CATEGORIES] },
          color: { type: 'string', description: 'Color o parte del nombre del color, p. ej. "azul".' },
          texto: { type: 'string', description: 'Tipo de prenda, estilo o estampado, p. ej. "blazer", "floral".' },
          ocasion: { type: 'string', description: 'p. ej. "trabajo", "fiesta", "casual".' },
          limite: { type: 'integer', minimum: 1, maximum: 15 },
        },
      },
      strict: false,
    },
  },
  {
    type: 'function',
    function: {
      name: 'proponer_outfits',
      description: 'Genera combinaciones reales con su armario (motor de BellAI: paleta, estilo, ocasión, clima y sus valoraciones). Úsala para «qué me pongo».',
      parameters: {
        type: 'object',
        properties: {
          ocasion: { type: 'string', description: 'Ocasión, p. ej. "entrevista", "boda", "oficina".' },
          temperatura_c: { type: 'number', description: 'Temperatura si la usuaria la menciona.' },
          lluvia: { type: 'boolean' },
          cantidad: { type: 'integer', minimum: 1, maximum: 3 },
        },
      },
      strict: false,
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_combinaciones_guardadas',
      description: 'Combinaciones que la usuaria guardó, con su valoración.',
      parameters: { type: 'object', properties: { solo_favoritas: { type: 'boolean' } } },
      strict: false,
    },
  },
];

/** Prenda en el formato mínimo que se le pasa al modelo (sin identificadores ni fotos). */
export function garmentSummary(g: Garment) {
  return {
    nombre: g.name || g.subcategory,
    tipo: g.subcategory,
    categoria: g.category,
    color: g.color,
    ...(g.pattern && g.pattern !== 'liso' ? { estampado: g.pattern } : {}),
    ...(g.season ? { temporada: g.season } : {}),
    ...(g.occasion || g.aiOccasion ? { ocasion: g.occasion || g.aiOccasion } : {}),
    usos: g.wearCount,
  };
}

/** Los modelos a veces mandan números y booleanos como texto («3», «True»): se interpretan igual. */
export function toNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function toBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return undefined;
  const t = normalize(v.trim());
  if (['true', 'si', 'yes', '1'].includes(t)) return true;
  if (['false', 'no', '0'].includes(t)) return false;
  return undefined;
}

const textArg = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Busca prendas. Si con todos los filtros no hay nada, quita los secundarios (ocasión y texto) y lo
 * dice: así un filtro de más que añada el modelo no le hace afirmar «no tienes prendas grises».
 */
export function searchGarments(garments: Garment[], args: Record<string, unknown>) {
  const has = (field: unknown, q?: string) => !q || normalize(String(field ?? '')).includes(normalize(q));
  const text = (g: Garment) => [g.name, g.subcategory, g.pattern, ...(g.styles ?? [])].join(' ');
  const limit = Math.min(15, Math.max(1, toNumber(args.limite) ?? 10));
  const filters = {
    categoria: (GARMENT_CATEGORIES as readonly string[]).includes(String(args.categoria)) ? String(args.categoria) : undefined,
    color: textArg(args.color),
    texto: textArg(args.texto),
    ocasion: textArg(args.ocasion),
  };
  const run = (f: typeof filters) => garments
    .filter((g) => (!f.categoria || g.category === f.categoria)
      && has(g.color, f.color)
      && has(text(g), f.texto)
      && has(`${g.occasion ?? ''} ${g.aiOccasion ?? ''}`, f.ocasion))
    .sort((x, y) => y.wearCount - x.wearCount);
  let found = run(filters);
  const relaxed: string[] = [];
  // Color y categoría son lo que se pidió: se respetan siempre; ocasión y texto se pueden quitar
  for (const key of ['ocasion', 'texto'] as const) {
    if (found.length || !filters[key]) continue;
    filters[key] = undefined;
    relaxed.push(key);
    found = run(filters);
  }
  return {
    coincidencias: found.length,
    prendas: found.slice(0, limit).map(garmentSummary),
    ...(relaxed.length && found.length ? { nota: `Sin coincidencias con todos los filtros; se quitó: ${relaxed.join(', ')}.` } : {}),
    ...(found.length ? {} : { nota: garments.length ? 'Ninguna prenda coincide con esos filtros.' : 'El armario está vacío.' }),
  };
}

/** Una propuesta del motor de outfits, sin identificadores, vectores ni URLs. */
export function outfitSummary(p: any) {
  return {
    titulo: p.title,
    puntuacion: Math.round((Number(p.score) || 0) * 100),
    prendas: (p.items ?? []).map((i: any) => `${i.role ? `${i.role}: ` : ''}${i.name || i.subcategory}${i.color ? ` (${i.color})` : ''}`),
    por_que: (p.explanation ?? []).slice(0, 3),
    // Con el papel delante («abrigo: …») para que no se lea como que le falta una prenda que ya tiene
    ...(p.missing?.length ? { sugerencia_para_completar: p.missing.map((m: any) => `${m.role}: ${m.suggestion}`).slice(0, 2) } : {}),
  };
}

/** Recorta el historial: los últimos mensajes, cada uno acotado, y un total máximo. */
export function trimHistory(
  rows: { role: 'user' | 'assistant'; content: string }[],
  opts: { maxMessages?: number; maxCharsEach?: number; maxTotal?: number } = {},
): ChatMessage[] {
  const { maxMessages = 8, maxCharsEach = 600, maxTotal = 3500 } = opts;
  const out: ChatMessage[] = [];
  let total = 0;
  for (const m of [...rows].reverse().slice(0, maxMessages)) {
    const content = m.content.length > maxCharsEach ? `${m.content.slice(0, maxCharsEach)}…` : m.content;
    if (total + content.length > maxTotal) break;
    total += content.length;
    out.unshift({ role: m.role, content });
  }
  // La conversación debe empezar por la usuaria
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

const NOISE_KEY = /^(id|ids|.*Id|.*_id|.*urls?|.*Url|.*uri|.*Uri|image.*|photo.*|foto.*|.*At|.*_at|dna|vector|embedding|engineVersion|rulesVersion|signature)$/i;

/** Quita de un resultado lo que no ayuda a explicarlo (ids, URLs, fechas, vectores) y lo acota. */
export function compactForLlm(data: unknown, depth = 0): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'number') return Math.round(data * 100) / 100;
  if (typeof data === 'string') return data.length > 240 ? `${data.slice(0, 240)}…` : data;
  if (typeof data !== 'object') return data;
  if (depth > 4) return undefined;
  if (Array.isArray(data)) return data.slice(0, 6).map((x) => compactForLlm(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (NOISE_KEY.test(k)) continue;
    const c = compactForLlm(v, depth + 1);
    if (c !== undefined && !(Array.isArray(c) && !c.length)) out[k] = c;
  }
  return out;
}
