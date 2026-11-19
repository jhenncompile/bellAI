/**
 * HU-012 / HU-013 / HU-014 / HU-037: motor de recomendaciones por reglas expertas.
 * Combina diagnóstico (paleta, rostro, silueta), preferencias declaradas, Style DNA,
 * ocasión y valoraciones previas. Cada sugerencia incluye su explicación (factor, valor, regla).
 * Función pura y determinista: los ids son estables para poder valorarlos.
 */
import { matchesDeclared } from '../../common/color/color.util';
import { DnaDimension, DnaVector, topDimensions } from './style-dna';

export const RULES_VERSION = 'reglas-1.0.0';

export type RecommendationType = 'color' | 'evitar_color' | 'corte_cabello' | 'color_cabello' | 'gafas' | 'escote' | 'prenda' | 'accesorio' | 'maquillaje' | 'linea';

export interface Explanation {
  factor: string;
  value: string;
  rule: string;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  detail?: string;
  hex?: string;
  score: number;
  explanation: Explanation[];
  feedback?: string | null;
}

export interface EngineInput {
  diagnosis: any | null;
  preferences: { preferredColors?: string[]; avoidedColors?: string[]; occasions?: string[]; budgetPerGarment?: number | null };
  dna: DnaVector;
  occasion?: string | null;
  feedback?: Record<string, string>;
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Prendas clave por dimensión dominante del Style DNA. */
const DNA_GARMENTS: Record<DnaDimension, string[]> = {
  elegancia: ['Blazer entallado', 'Pantalón de pinzas', 'Blusa de seda'],
  minimalismo: ['Camiseta básica de buena calidad', 'Pantalón recto neutro', 'Abrigo sin adornos'],
  romanticismo: ['Blusa con volantes', 'Falda midi fluida', 'Vestido con estampado floral'],
  naturalidad: ['Jeans rectos', 'Camisa de lino', 'Zapatillas blancas'],
  dramatismo: ['Abrigo largo estructurado', 'Pieza en color intenso', 'Botas altas'],
  clasicismo: ['Camisa blanca', 'Gabardina beige', 'Mocasines'],
  experimentalidad: ['Prenda con estampado gráfico', 'Accesorio llamativo', 'Mezcla de texturas'],
};

/** Prendas por ocasión (usadas cuando se indica contexto). */
const OCCASION_GARMENTS: Record<string, string[]> = {
  trabajo: ['Blazer', 'Pantalón de vestir', 'Blusa lisa', 'Zapato cerrado'],
  universidad: ['Jeans', 'Suéter cómodo', 'Zapatillas', 'Mochila o bolso amplio'],
  formal: ['Vestido midi', 'Traje de chaqueta', 'Zapato de tacón medio'],
  fiesta: ['Vestido o top protagonista', 'Accesorio brillante', 'Calzado con tacón'],
  cita: ['Blusa favorecedora', 'Falda o pantalón fluido', 'Accesorio delicado'],
  entrevista: ['Blazer neutro', 'Camisa lisa', 'Pantalón recto', 'Calzado cerrado y cómodo'],
  casual: ['Jeans', 'Camiseta básica', 'Zapatillas'],
  deporte: ['Leggings', 'Top deportivo', 'Zapatillas deportivas'],
  playa: ['Vestido ligero', 'Sandalias', 'Sombrero'],
};

export function normalizeOccasion(o?: string | null): string | null {
  if (!o) return null;
  const s = slug(o);
  if (s.includes('trabajo') || s.includes('oficina')) return 'trabajo';
  if (s.includes('univers') || s.includes('clase')) return 'universidad';
  if (s.includes('entrevista')) return 'entrevista';
  if (s.includes('formal') || s.includes('gala') || s.includes('boda')) return 'formal';
  if (s.includes('fiesta') || s.includes('noche') || s.includes('nocturn')) return 'fiesta';
  if (s.includes('cita') || s.includes('social')) return 'cita';
  if (s.includes('deport') || s.includes('gym')) return 'deporte';
  if (s.includes('playa')) return 'playa';
  if (s.includes('casual') || s.includes('diario')) return 'casual';
  return s || null;
}

const FEEDBACK_FACTOR: Record<string, number> = { me_gusta: 1.25, neutral: 0.95, no_me_gusta: 0 };

export function recommend(input: EngineInput): Recommendation[] {
  const { diagnosis: d, preferences: p, dna } = input;
  const out: Recommendation[] = [];
  const add = (r: Omit<Recommendation, 'id'> & { id?: string }) => {
    const id = r.id ?? `${r.type}:${slug(r.title)}`;
    if (!out.some((x) => x.id === id)) out.push({ ...r, id });
  };
  const season = d?.season as string | undefined;
  const undertone = d?.undertone as string | undefined;
  const face = d?.faceShape as string | undefined;
  const body = d?.bodyType as string | undefined;
  const rec = d?.recommendations ?? {};

  // 1. Colores de la paleta, respetando lo que la usuaria quiere evitar (prioridad declarada)
  const palette: any[] = [...(rec.colors?.recommended ?? []), ...(rec.colors?.accents ?? []), ...(rec.colors?.neutrals ?? [])];
  for (const sw of palette) {
    const avoided = matchesDeclared(sw.name, sw.hex, p.avoidedColors);
    if (avoided) continue;
    const preferred = matchesDeclared(sw.name, sw.hex, p.preferredColors);
    const explanation: Explanation[] = [
      { factor: 'Estación de color', value: season ?? '-', rule: `Los colores de la paleta ${season} armonizan con tu subtono ${undertone?.toLowerCase() ?? ''}.` },
    ];
    if (preferred) explanation.push({ factor: 'Tus preferencias', value: preferred, rule: 'Coincide con un color que marcaste como favorito.' });
    if (sw.category === 'neutro') explanation.push({ factor: 'Uso', value: 'Neutro', rule: 'Úsalo como base: combina con tus acentos.' });
    add({
      type: 'color', title: sw.name, hex: sw.hex,
      detail: sw.usageTip || (sw.category === 'acento' ? 'Úsalo cerca del rostro o como prenda protagonista.' : 'Ideal para prendas base.'),
      score: (sw.category === 'acento' ? 0.8 : 0.75) + (preferred ? 0.15 : 0),
      explanation,
    });
  }

  // 2. Colores a evitar (diagnóstico + declarados)
  for (const t of rec.colors?.avoid ?? []) {
    add({ type: 'evitar_color', title: t.name, hex: t.hex, detail: t.reason, score: 0.7,
      explanation: [{ factor: 'Estación de color', value: season ?? '-', rule: t.reason }] });
  }
  for (const c of p.avoidedColors ?? []) {
    add({ type: 'evitar_color', title: c, score: 0.65, detail: 'Lo marcaste como color a evitar.',
      explanation: [{ factor: 'Tus preferencias', value: c, rule: 'Las preferencias que declaras tienen prioridad sobre las sugerencias automáticas.' }] });
  }

  // 3. Rostro: cortes, gafas, accesorios
  const faceRule = (what: string) => ({ factor: 'Forma del rostro', value: face ?? '-', rule: `Para un rostro ${face?.toLowerCase()}, ${what}.` });
  for (const cut of rec.haircuts ?? []) add({ type: 'corte_cabello', title: cut, score: 0.7, explanation: [faceRule('este corte equilibra las proporciones')] });
  for (const g of rec.glasses ?? []) {
    add({ type: 'gafas', title: g, score: 0.6, explanation: [g.startsWith('Color de montura')
      ? { factor: 'Estación de color', value: season ?? '-', rule: 'El color de la montura acompaña tu paleta.' }
      : faceRule('esta montura contrasta con la forma del rostro')] });
  }
  for (const a of rec.accessories ?? []) add({ type: 'accesorio', title: a, score: 0.55, explanation: [faceRule('este accesorio favorece la línea del rostro')] });
  for (const m of rec.metals ?? []) {
    add({ type: 'accesorio', title: `Joyería en ${m.toLowerCase()}`, score: 0.6,
      explanation: [{ factor: 'Subtono de piel', value: undertone ?? '-', rule: `Los metales ${undertone === 'Calido' ? 'dorados' : 'plateados'} armonizan con un subtono ${undertone?.toLowerCase()}.` }] });
  }
  for (const shade of rec.hairShades ?? []) {
    add({ type: 'color_cabello', title: shade, score: 0.55,
      explanation: [{ factor: 'Estación de color', value: season ?? '-', rule: 'Este tono de cabello mantiene la armonía con tu piel y ojos.' }] });
  }

  // 4. Escotes y prendas según silueta
  for (const n of rec.necklines ?? []) {
    add({ type: 'escote', title: `Escote ${n.toLowerCase()}`, score: 0.6,
      explanation: [{ factor: body ? 'Silueta y rostro' : 'Forma del rostro', value: [face, body].filter(Boolean).join(' · ') || '-', rule: 'Este escote equilibra cuello, hombros y rostro.' }] });
  }
  for (const cut of rec.garmentCuts ?? []) {
    add({ type: 'prenda', title: cut, score: 0.7,
      explanation: [{ factor: 'Silueta', value: body ?? '-', rule: 'Este corte armoniza las proporciones de hombros, cintura y cadera.' }] });
  }
  for (const l of [...(rec.lines ?? []), ...(rec.lengths ?? [])]) {
    add({ type: 'linea', title: l, score: 0.5, explanation: [{ factor: 'Silueta', value: body ?? '-', rule: 'Orientación sobre líneas y largos que favorecen tu proporción.' }] });
  }

  // 5. Maquillaje según estación y contraste
  for (const lip of rec.lipsticks ?? []) {
    add({ type: 'maquillaje', title: `Labial ${lip.toLowerCase()}`, score: 0.55,
      explanation: [{ factor: 'Estación de color', value: season ?? '-', rule: 'Tono de labial dentro de tu paleta.' }] });
  }
  if (d?.contrastLevel) {
    const rule = d.colorimetry?.explanations?.contrastRule;
    if (rule) add({ type: 'linea', title: `Combinaciones de contraste ${String(d.contrastLevel).toLowerCase()}`, detail: rule, score: 0.65,
      explanation: [{ factor: 'Contraste personal', value: d.contrastLevel, rule }] });
  }

  // 6. Prendas clave por Style DNA
  for (const top of topDimensions(dna, 2)) {
    for (const g of DNA_GARMENTS[top.dimension]) {
      add({ type: 'prenda', title: g, score: 0.5 + top.value / 250,
        explanation: [{ factor: 'Style DNA', value: `${top.label} ${Math.round(top.value)}`, rule: top.description }] });
    }
  }

  // 7. Contexto de ocasión
  const occ = normalizeOccasion(input.occasion);
  if (occ && OCCASION_GARMENTS[occ]) {
    for (const g of OCCASION_GARMENTS[occ]) {
      add({ id: `prenda:${slug(g)}:${occ}`, type: 'prenda', title: g, score: 0.85,
        explanation: [{ factor: 'Ocasión', value: input.occasion!, rule: 'Prenda adecuada para el contexto que indicaste.' }] });
    }
  }
  if (p.budgetPerGarment) {
    for (const r of out.filter((x) => x.type === 'prenda')) {
      r.explanation.push({ factor: 'Presupuesto', value: `${p.budgetPerGarment} por prenda`, rule: 'Busca primero en tu armario; si compras, prioriza básicos versátiles dentro de tu presupuesto.' });
    }
  }

  // 8. Aprendizaje: lo que no le gustó desaparece; lo que le gustó sube
  const fb = input.feedback ?? {};
  return out
    .map((r) => {
      const value = fb[r.id] ?? null;
      const factor = value ? FEEDBACK_FACTOR[value] ?? 1 : 1;
      return { ...r, feedback: value, score: Math.round(Math.min(1, r.score * factor) * 100) / 100 };
    })
    .filter((r) => r.feedback !== 'no_me_gusta')
    .sort((a, b) => b.score - a.score);
}
