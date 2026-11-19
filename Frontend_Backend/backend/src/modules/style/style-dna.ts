/**
 * HU-007 / HU-008 / HU-039: Style DNA.
 * Vector de 7 dimensiones estéticas (0-100) que combina:
 *  - lo declarado por la usuaria (prioridad máxima, regla de HU-001),
 *  - lo inferido del diagnóstico (contraste, forma de rostro, silueta),
 *  - lo aprendido de sus valoraciones (me gusta / neutral / no me gusta).
 * Funciones puras: se prueban sin base de datos.
 */
export const DNA_DIMENSIONS = [
  'elegancia',
  'minimalismo',
  'romanticismo',
  'naturalidad',
  'dramatismo',
  'clasicismo',
  'experimentalidad',
] as const;

export type DnaDimension = (typeof DNA_DIMENSIONS)[number];
export type DnaVector = Record<DnaDimension, number>;

const v = (e: number, m: number, r: number, n: number, d: number, c: number, x: number): DnaVector => ({
  elegancia: e, minimalismo: m, romanticismo: r, naturalidad: n, dramatismo: d, clasicismo: c, experimentalidad: x,
});

/** Catálogo de estilos (los de la app móvil y los de la tabla `estilo`) traducidos a dimensiones. */
export const STYLE_CATALOG: Record<string, DnaVector> = {
  'old money chic': v(85, 55, 30, 35, 30, 90, 10),
  'clean girl aesthetic': v(55, 85, 30, 75, 10, 45, 15),
  'minimalista sofisticado': v(70, 95, 15, 45, 25, 55, 15),
  minimalista: v(60, 95, 15, 50, 20, 50, 15),
  'quiet luxury': v(90, 80, 20, 40, 20, 80, 5),
  'romántico clásico': v(60, 25, 95, 40, 20, 60, 20),
  romántico: v(50, 25, 95, 45, 25, 45, 25),
  'dark academia': v(60, 35, 40, 30, 60, 75, 35),
  'streetwear / urbano': v(15, 35, 10, 60, 55, 10, 80),
  urbano: v(15, 35, 10, 60, 55, 10, 80),
  'y2k glam': v(30, 10, 45, 15, 75, 10, 95),
  clásico: v(75, 50, 30, 40, 25, 95, 10),
  casual: v(25, 50, 25, 85, 15, 35, 30),
  creativo: v(30, 15, 40, 35, 65, 15, 95),
  bohemio: v(25, 15, 75, 80, 30, 20, 60),
  deportivo: v(10, 55, 5, 90, 15, 20, 30),
  elegante: v(95, 55, 40, 25, 40, 75, 15),
};

export const NEUTRAL_DNA: DnaVector = v(50, 50, 50, 50, 50, 50, 50);

export const DIMENSION_LABELS: Record<DnaDimension, { label: string; description: string }> = {
  elegancia: { label: 'Elegancia', description: 'Prendas pulidas, cortes limpios y acabados cuidados.' },
  minimalismo: { label: 'Minimalismo', description: 'Pocas piezas, colores sobrios y líneas simples.' },
  romanticismo: { label: 'Romanticismo', description: 'Tejidos suaves, volantes, flores y formas curvas.' },
  naturalidad: { label: 'Naturalidad', description: 'Comodidad, tejidos naturales y looks relajados.' },
  dramatismo: { label: 'Dramatismo', description: 'Contrastes fuertes, siluetas marcadas y piezas protagonistas.' },
  clasicismo: { label: 'Clasicismo', description: 'Básicos atemporales y combinaciones tradicionales.' },
  experimentalidad: { label: 'Experimentalidad', description: 'Tendencias, mezclas inesperadas y piezas originales.' },
};

export function normalizeStyleName(name: string): string {
  return name.trim().toLowerCase();
}

export function styleVector(name: string): DnaVector | null {
  return STYLE_CATALOG[normalizeStyleName(name)] ?? null;
}

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x * 10) / 10));

export function average(vectors: DnaVector[]): DnaVector | null {
  if (!vectors.length) return null;
  const out = {} as DnaVector;
  for (const d of DNA_DIMENSIONS) out[d] = clamp(vectors.reduce((a, x) => a + x[d], 0) / vectors.length);
  return out;
}

/** Vector declarado: media de los estilos preferidos, alejándose de los que no le gustan. */
export function declaredVector(preferred: string[] = [], disliked: string[] = []): DnaVector | null {
  const pos = preferred.map(styleVector).filter(Boolean) as DnaVector[];
  const neg = disliked.map(styleVector).filter(Boolean) as DnaVector[];
  const base = average(pos);
  if (!base && !neg.length) return null;
  const out = { ...(base ?? NEUTRAL_DNA) };
  const avoid = average(neg);
  if (avoid) for (const d of DNA_DIMENSIONS) out[d] = clamp(out[d] - (avoid[d] - 50) * 0.35);
  return out;
}

/** Inferencia suave desde el diagnóstico (no sustituye lo que declara la usuaria). */
export function inferredVector(diagnosis: any | null): DnaVector | null {
  if (!diagnosis) return null;
  const out = { ...NEUTRAL_DNA };
  const contrast = diagnosis.contrastLevel;
  if (contrast === 'Alto') { out.dramatismo += 15; out.elegancia += 5; }
  if (contrast === 'Bajo') { out.romanticismo += 8; out.naturalidad += 10; out.dramatismo -= 10; }
  const face = diagnosis.faceShape;
  if (['Cuadrado', 'Rectangular', 'Diamante'].includes(face)) { out.dramatismo += 6; out.clasicismo += 6; }
  if (['Redondo', 'Corazon'].includes(face)) { out.romanticismo += 8; }
  const body = diagnosis.bodyType || '';
  if (body.startsWith('Reloj')) out.romanticismo += 8;
  if (body.startsWith('Rectangular')) { out.minimalismo += 6; out.naturalidad += 6; }
  if (body.startsWith('Triangulo Invertido')) out.dramatismo += 5;
  const season: string = diagnosis.season || '';
  if (season.includes('Brillante')) out.experimentalidad += 8;
  if (season.includes('Suave')) out.minimalismo += 6;
  for (const d of DNA_DIMENSIONS) out[d] = clamp(out[d]);
  return out;
}

export const FEEDBACK_WEIGHT = { me_gusta: 1, neutral: 0, no_me_gusta: -1 } as const;
export type FeedbackValue = keyof typeof FEEDBACK_WEIGHT;

/**
 * Aprendizaje: desplaza el componente aprendido hacia (me gusta) o lejos de (no me gusta)
 * los atributos del elemento valorado. La tasa decrece con el número de interacciones
 * para que el perfil se estabilice.
 */
export function learn(learned: DnaVector, target: DnaVector, value: FeedbackValue, interactions: number): DnaVector {
  const w = FEEDBACK_WEIGHT[value];
  if (!w) return learned;
  const rate = Math.max(0.05, 0.3 / Math.sqrt(1 + interactions / 5));
  const out = {} as DnaVector;
  for (const d of DNA_DIMENSIONS) {
    const pull = (target[d] - learned[d]) * rate;
    out[d] = clamp(w > 0 ? learned[d] + pull : learned[d] - (target[d] - 50) * rate * 0.6);
  }
  return out;
}

export interface DnaSources {
  declared: DnaVector | null;
  inferred: DnaVector | null;
  learned: DnaVector | null;
  /** HU-13: lo que dice su armario (estilo de las prendas que registra y usa). */
  wardrobe?: DnaVector | null;
}

export type DnaSource = keyof DnaSources;

/** Prendas mínimas para que el armario cuente: con una o dos el perfil daría saltos. */
export const MIN_WARDROBE_ITEMS = 3;

export const SOURCE_LABELS: Record<DnaSource, string> = {
  declared: 'Tus estilos preferidos',
  inferred: 'Tu diagnóstico',
  wardrobe: 'Tu armario',
  learned: 'Tus valoraciones',
};

/**
 * Peso de cada fuente (sin normalizar). Lo declarado manda (regla de HU-001); el diagnóstico pesa
 * menos si ya hay preferencias; el armario y las valoraciones ganan peso con el uso, con tope.
 */
export function sourceWeights(sources: DnaSources, interactions: number, wardrobeItems = 0): Partial<Record<DnaSource, number>> {
  const w: Partial<Record<DnaSource, number>> = {};
  if (sources.declared) w.declared = 0.6;
  if (sources.inferred) w.inferred = sources.declared ? 0.2 : 0.5;
  if (sources.wardrobe && wardrobeItems >= MIN_WARDROBE_ITEMS) w.wardrobe = Math.min(0.3, 0.04 * wardrobeItems);
  if (sources.learned) w.learned = Math.min(0.4, 0.08 + interactions * 0.02);
  return w;
}

/** Combinación final: lo declarado pesa más; armario y valoraciones ganan peso con el uso. */
export function combine(sources: DnaSources, interactions: number, wardrobeItems = 0): DnaVector {
  const weights = sourceWeights(sources, interactions, wardrobeItems);
  const parts = (Object.keys(weights) as DnaSource[]).map((k) => [sources[k] as DnaVector, weights[k] as number] as const);
  if (!parts.length) return { ...NEUTRAL_DNA };
  const total = parts.reduce((a, [, w]) => a + w, 0);
  const out = {} as DnaVector;
  for (const d of DNA_DIMENSIONS) out[d] = clamp(parts.reduce((a, [vec, w]) => a + vec[d] * w, 0) / total);
  return out;
}

/** Cuánto aporta cada fuente al perfil, en porcentaje (suma 100). */
export function contributions(sources: DnaSources, interactions: number, wardrobeItems = 0): { source: DnaSource; label: string; percent: number }[] {
  const weights = sourceWeights(sources, interactions, wardrobeItems);
  const keys = Object.keys(weights) as DnaSource[];
  const total = keys.reduce((a, k) => a + (weights[k] as number), 0);
  if (!total) return [];
  const out = keys.map((k) => ({ source: k, label: SOURCE_LABELS[k], percent: Math.round(((weights[k] as number) / total) * 100) }));
  // El redondeo puede dejar 99 o 101: se corrige en la fuente más grande
  const diff = 100 - out.reduce((a, x) => a + x.percent, 0);
  if (diff) out.sort((a, b) => b.percent - a.percent)[0].percent += diff;
  return out.sort((a, b) => b.percent - a.percent);
}

/** Vector del armario: media del ADN de cada prenda; las que más usa pesan más (hasta el triple). */
export function wardrobeVector(garments: { dna: DnaVector; wearCount: number }[]): DnaVector | null {
  if (garments.length < MIN_WARDROBE_ITEMS) return null;
  const weighted = garments.map((g) => ({ dna: g.dna, w: 1 + Math.min(2, Math.max(0, g.wearCount) / 3) }));
  const total = weighted.reduce((a, g) => a + g.w, 0);
  const out = {} as DnaVector;
  for (const d of DNA_DIMENSIONS) out[d] = clamp(weighted.reduce((a, g) => a + g.dna[d] * g.w, 0) / total);
  return out;
}

/**
 * ¿Mismo vector? Se compara dimensión a dimensión: el JSONB de PostgreSQL reordena las claves, así que
 * JSON.stringify daría «distinto» con los mismos valores (y se guardaba un punto de historial en cada visita).
 */
export function sameVector(a?: DnaVector | null, b?: DnaVector | null): boolean {
  if (!a || !b) return !a && !b;
  return DNA_DIMENSIONS.every((d) => Number(a[d]) === Number(b[d]));
}

/** Por qué cambió el perfil, para el historial: la primera fuente que cambió (declarado > diagnóstico > armario). */
export function changeReason(prev: Partial<DnaSources> | null | undefined, next: DnaSources): string {
  if (!prev) return 'creacion';
  if (!sameVector(prev.declared, next.declared)) return 'preferencias';
  if (!sameVector(prev.inferred, next.inferred)) return 'diagnostico';
  if (!sameVector(prev.wardrobe, next.wardrobe)) return 'armario';
  if (!sameVector(prev.learned, next.learned)) return 'valoraciones';
  return 'recalculo';
}

export const REASON_LABELS: Record<string, string> = {
  creacion: 'Se creó tu perfil',
  preferencias: 'Cambiaste tus estilos preferidos',
  diagnostico: 'Nuevo diagnóstico',
  armario: 'Cambios en tu armario',
  valoraciones: 'Valoraste recomendaciones',
  recalculo: 'Se actualizó tu perfil',
};

/** Dimensiones que más se movieron entre dos momentos (al menos 3 puntos). */
export function dimensionChanges(from: DnaVector, to: DnaVector, n = 3): { dimension: DnaDimension; label: string; from: number; to: number; delta: number }[] {
  return DNA_DIMENSIONS
    .map((d) => ({ dimension: d, label: DIMENSION_LABELS[d].label, from: from[d], to: to[d], delta: Math.round((to[d] - from[d]) * 10) / 10 }))
    .filter((x) => Math.abs(x.delta) >= 3)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, n);
}

export function topDimensions(dna: DnaVector, n = 3): { dimension: DnaDimension; value: number; label: string; description: string }[] {
  return [...DNA_DIMENSIONS]
    .sort((a, b) => dna[b] - dna[a])
    .slice(0, n)
    .map((d) => ({ dimension: d, value: dna[d], ...DIMENSION_LABELS[d] }));
}

/** Margen sobre el punto neutro (50) para que una dimensión cuente como «predominante». */
export const PREDOMINANT_MARGIN = 5;

/** Dimensiones que de verdad destacan; un perfil neutro (todo 50) no tiene ninguna. */
export function predominantDimensions(dna: DnaVector, n = 2): string[] {
  return topDimensions(dna, n).filter((t) => t.value >= 50 + PREDOMINANT_MARGIN).map((t) => t.label);
}

/**
 * Historial legible (más reciente primero): un punto seguido de otro idéntico no es un cambio,
 * así que de cada tramo sin cambios se conserva el más antiguo (cuando empezó ese estado).
 */
export function collapseHistory<T extends { dimensions: DnaVector }>(points: T[]): T[] {
  return points.filter((p, i) => i === points.length - 1 || !sameVector(p.dimensions, points[i + 1].dimensions));
}

export function closestStyles(dna: DnaVector, n = 3): { style: string; similarity: number }[] {
  const dist = (a: DnaVector, b: DnaVector) => Math.sqrt(DNA_DIMENSIONS.reduce((s, d) => s + (a[d] - b[d]) ** 2, 0));
  const maxDist = Math.sqrt(DNA_DIMENSIONS.length * 100 ** 2);
  const seen = new Set<string>();
  return Object.entries(STYLE_CATALOG)
    .map(([style, vec]) => ({ style, similarity: Math.round((1 - dist(dna, vec) / maxDist) * 100) }))
    .sort((a, b) => b.similarity - a.similarity)
    .filter((x) => {
      const key = x.style.split(' ')[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, n)
    .map((x) => ({ ...x, style: x.style.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }));
}
