/**
 * HU-005 / HU-036: integra los resultados facial, cromático y corporal en un único
 * diagnóstico con resumen, puntuación de confianza y recomendaciones combinadas.
 * Función pura para poder probarla sin base de datos ni servicio de IA.
 */
export interface FaceAnalysis {
  quality?: any;
  face: any;
  colorimetry: any;
}

export interface BodyAnalysis {
  quality?: any;
  body: any;
}

export interface IntegratedDiagnosis {
  faceShape: string | null;
  skinTone: string | null;
  undertone: string | null;
  season: string | null;
  contrastLevel: string | null;
  bodyType: string | null;
  confidence: { face?: number; colorimetry?: number; body?: number; overall: number };
  modelVersions: Record<string, string>;
  summary: string;
  highlights: string[];
  palette: any;
  face: any;
  colorimetry: any;
  body: any;
  hair: any;
  recommendations: {
    colors: { recommended: any[]; neutrals: any[]; accents: any[]; avoid: any[] };
    haircuts: string[];
    /** Cuidados según la textura del cabello (CLIP); vacío si la textura es dudosa */
    hairCare: string[];
    /** Maquillaje según la geometría de ojos y labios; vacío si la cara estaba girada */
    makeup: string[];
    hairShades: string[];
    glasses: string[];
    necklines: string[];
    accessories: string[];
    metals: string[];
    lipsticks: string[];
    garmentCuts: string[];
    lines: string[];
    lengths: string[];
  };
}

const UNDERTONE_TEXT: Record<string, string> = { Calido: 'cálido', Frio: 'frío', Neutro: 'neutro' };
const FACE_TEXT: Record<string, string> = {
  Ovalado: 'ovalado', Redondo: 'redondo', Cuadrado: 'cuadrado', Rectangular: 'alargado',
  Corazon: 'en forma de corazón', Diamante: 'en forma de diamante',
};

function uniq(list: (string | undefined | null)[]): string[] {
  return [...new Set(list.filter((x): x is string => Boolean(x)))];
}

/**
 * HU-12: une el análisis nuevo con la parte que falte de su último diagnóstico guardado. Si hoy solo
 * envía la foto de cuerpo, se conservan su rostro y su piel (y al revés), para que el resumen
 * siga siendo integral. Lo nuevo siempre sustituye a lo anterior.
 */
export function mergeAnalyses(
  face: FaceAnalysis | null,
  body: BodyAnalysis | null,
  previous?: { face?: any; colorimetry?: any; body?: any } | null,
): { face: FaceAnalysis | null; body: BodyAnalysis | null } {
  const p = previous ?? null;
  return {
    face: face ?? (p?.face && p?.colorimetry ? { face: p.face, colorimetry: p.colorimetry } : null),
    body: body ?? (p?.body ? { body: p.body } : null),
  };
}

export function buildIntegratedDiagnosis(face?: FaceAnalysis | null, body?: BodyAnalysis | null): IntegratedDiagnosis {
  const f = face?.face ?? null;
  const c = face?.colorimetry ?? null;
  const b = body?.body ?? null;
  const confidences = [f?.confidence, c?.confidence, b?.confidence].filter((x) => typeof x === 'number') as number[];
  const overall = confidences.length ? confidences.reduce((a, x) => a + x, 0) / confidences.length : 0;

  const parts: string[] = [];
  if (c) parts.push(`Tu piel es ${String(c.skinTone).toLowerCase()} con subtono ${UNDERTONE_TEXT[c.undertone] ?? c.undertone}, lo que corresponde a la estación ${c.season}.`);
  if (f) parts.push(`Tu rostro es ${FACE_TEXT[f.faceShape] ?? String(f.faceShape).toLowerCase()}.`);
  if (b) parts.push(`Tu silueta se describe como ${b.bodyType}; ${String(b.verticality).toLowerCase()}.`);
  if (b && Array.isArray(b.warnings)) parts.push(...b.warnings);
  if (!parts.length) parts.push('Aún no hay suficientes datos para un diagnóstico.');

  const highlights = uniq([
    c && `Paleta ${c.season}`,
    c && `Contraste ${String(c.contrastLevel).toLowerCase()}`,
    f && `Rostro ${FACE_TEXT[f.faceShape] ?? String(f.faceShape).toLowerCase()}`,
    b && b.bodyType,
    c?.hair?.detected && `Cabello ${String(c.hair.length).toLowerCase()} ${String(c.hair.baseColor?.name ?? '').toLowerCase()}`.trim(),
    // Textura (CLIP): solo si el modelo está razonablemente seguro
    c?.hair?.texture && !c.hair.texture.uncertain && `Textura ${String(c.hair.texture.type).toLowerCase()}`,
  ]);

  const colors = c?.colors ?? {};
  return {
    faceShape: f?.faceShape ?? null,
    skinTone: c?.skinTone ?? null,
    undertone: c?.undertone ?? null,
    season: c?.season ?? null,
    contrastLevel: c?.contrastLevel ?? null,
    bodyType: b?.bodyType ?? null,
    confidence: { face: f?.confidence, colorimetry: c?.confidence, body: b?.confidence, overall: Math.round(overall * 1000) / 1000 },
    modelVersions: Object.fromEntries(
      [['face', f?.modelVersion], ['colorimetry', c?.modelVersion], ['body', b?.modelVersion], ['quality', face?.quality?.modelVersion ?? body?.quality?.modelVersion]].filter(([, v]) => v),
    ),
    summary: parts.join(' '),
    highlights,
    palette: colors.palette ?? [],
    face: f,
    colorimetry: c,
    body: b,
    hair: c?.hair ?? null,
    recommendations: {
      colors: {
        recommended: colors.recommended ?? [],
        neutrals: colors.neutrals ?? [],
        accents: colors.accents ?? [],
        avoid: colors.toxicColors ?? [],
      },
      haircuts: f?.recommendations?.cortes ?? [],
      makeup: f?.features?.reliable ? f.features.makeupTips ?? [] : [],
      hairCare: c?.hair?.texture && !c.hair.texture.uncertain ? c.hair.texture.care ?? [] : [],
      hairShades: colors.hairShades ?? [],
      glasses: uniq([...(f?.recommendations?.gafas ?? []), ...(colors.glassesFrames ?? []).map((x: string) => `Color de montura: ${x}`)]),
      necklines: uniq([...(f?.recommendations?.escotes ?? []), ...(b?.recommendations?.necklines ?? [])]),
      accessories: f?.recommendations?.accesorios ?? [],
      metals: colors.recommendedMetals ?? [],
      lipsticks: colors.lipsticks ?? [],
      garmentCuts: b?.recommendations?.cuts ?? [],
      lines: b?.recommendations?.lines ?? [],
      lengths: b?.recommendations?.lengths ?? [],
    },
  };
}

/** Contrato que ya consume la app móvil en /vision/analyze-face (compatibilidad). */
export function toLegacyFaceContract(face: FaceAnalysis) {
  const f = face.face;
  const c = face.colorimetry;
  return {
    success: true,
    faceShape: f.faceShape,
    faceShapeConfidence: f.confidence,
    skinTone: c.skinTone,
    undertone: c.undertone,
    season: c.season,
    contrastLevel: c.contrastLevel,
    facialSymmetry: Math.round((f.metrics?.symmetry ?? 0) * 100),
    colors: {
      palette: c.colors.palette,
      toxicColors: c.colors.toxicColors,
      recommendedMetals: c.colors.recommendedMetals,
    },
    metrics: { ...c.metrics, face: f.metrics },
    explanations: c.explanations,
    landmarks: f.landmarks,
    recommendations: f.recommendations,
    hair: c.hair,
    modelVersions: { face: f.modelVersion, colorimetry: c.modelVersion },
  };
}
