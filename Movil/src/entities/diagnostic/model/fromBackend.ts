import type { BodyType, ColorSeason, ContrastLevel, DiagnosticResult, FaceShape, Undertone } from './types';
import type { IntegratedDiagnosis } from '@/features/bellai/api/types';

const BODY_TYPES: BodyType[] = ['Reloj de Arena (Hourglass)', 'Triangulo / Pera', 'Triangulo Invertido', 'Rectangular / Atletica', 'Oval / Manzana'];

function metals(list: string[] = []): DiagnosticResult['recommendedMetals'] {
  const out = new Set<'Plata' | 'Oro' | 'Oro Rosa'>();
  for (const m of list) {
    const l = m.toLowerCase();
    if (l.includes('plata') || l.includes('platino') || l.includes('blanco')) out.add('Plata');
    else if (l.includes('rosa')) out.add('Oro Rosa');
    else out.add('Oro');
  }
  return out.size ? [...out] : ['Plata'];
}

/** Textura del cabello: solo si el modelo está razonablemente seguro (no se muestra una suposición). */
function hairTexture(d: IntegratedDiagnosis): DiagnosticResult['hairTexture'] {
  const t = d.hair?.texture;
  if (!t || t.uncertain || typeof t.type !== 'string') return undefined;
  return { type: t.type, probability: Number(t.probability) || 0, care: d.recommendations?.hairCare ?? t.care ?? [] };
}

/** Rasgos de ojos y labios: solo con la cara de frente (con la cara girada la medida se deforma). */
function beautyAdvice(d: IntegratedDiagnosis): DiagnosticResult['beautyAdvice'] {
  const feats = d.face?.features;
  if (!feats?.reliable) return undefined;
  const lower = (s: unknown) => String(s ?? '').toLowerCase();
  const traits = [
    feats.eyes?.tilt && `Ojos ${lower(feats.eyes.tilt)}`,
    feats.eyes?.spacing && feats.eyes.spacing !== 'Equilibrados' && `Ojos ${lower(feats.eyes.spacing)}`,
    feats.eyes?.size && feats.eyes.size !== 'Medios' && `Ojos ${lower(feats.eyes.size)}`,
    feats.lips?.volume && `Labios ${lower(feats.lips.volume)}`,
  ].filter((x): x is string => Boolean(x));
  const makeupTips: string[] = d.recommendations?.makeup ?? feats.makeupTips ?? [];
  return traits.length || makeupTips.length ? { traits, makeupTips } : undefined;
}

/** Convierte el diagnóstico integral del backend al modelo que usan las pantallas de "Mi análisis". */
export function diagnosticFromBackend(d: IntegratedDiagnosis, imageUri = ''): DiagnosticResult {
  const c = d.colorimetry ?? {};
  const f = d.face ?? {};
  const rec = d.recommendations;
  const deltaL = c.metrics?.deltaL;
  return {
    id: d.id,
    timestamp: new Date(d.createdAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    imageUri,
    skinTone: d.skinTone ?? 'Sin datos',
    undertone: (d.undertone ?? 'Neutro') as Undertone,
    season: (d.season ?? 'Verano Suave (Soft Summer)') as ColorSeason,
    faceShape: (d.faceShape ?? 'Ovalado') as FaceShape,
    bodyType: (BODY_TYPES.includes(d.bodyType as BodyType) ? d.bodyType : 'Pendiente de escaneo corporal') as BodyType,
    recommendedMetals: metals(rec?.metals),
    contrastLevel: (d.contrastLevel ?? 'Medio') as ContrastLevel,
    palette: (d.palette ?? []).map((s) => ({ hex: s.hex, name: s.name, category: s.category ?? 'base', usageTip: s.usageTip })),
    facialSymmetry: f.metrics?.symmetry !== undefined ? Math.round(f.metrics.symmetry * 100) : undefined,
    toxicColors: (rec?.colors?.avoid ?? []).map((t) => ({ hex: t.hex, name: t.name, negativeEffect: t.reason })),
    munsell: c.metrics
      ? {
          temperatureScore: Math.round((c.metrics.scores?.temperature ?? 0) * 100),
          valueScore: Math.round(c.metrics.lab?.L ?? 50),
          chromaScore: Math.round((c.metrics.chroma ?? 0) * 3),
          dominantDimension: c.dominantCharacteristic === 'temperatura' ? 'Temperatura' : c.dominantCharacteristic === 'profundidad' ? 'Profundidad' : 'Croma',
        }
      : undefined,
    contrastMetric: deltaL !== undefined
      ? {
          deltaL,
          level: d.contrastLevel === 'Alto' ? 'Alto Contraste' : d.contrastLevel === 'Bajo' ? 'Bajo Contraste' : 'Contraste Medio',
          stylingRule: c.explanations?.contrastRule ?? '',
        }
      : undefined,
    biometricMetrics: c.metrics
      ? { lab: c.metrics.lab, deltaL: c.metrics.deltaL, chroma: c.metrics.chroma, lengthToWidthRatio: f.metrics?.lengthToWidth }
      : undefined,
    hairAdvice: {
      recommendedCuts: rec?.haircuts ?? [],
      recommendedShades: rec?.hairShades ?? [],
      avoidShades: c.colors?.avoidHairShades ?? [],
    },
    glassesAdvice: {
      recommendedFrames: rec?.glasses ?? [],
      avoidFrames: f.recommendations?.evitarGafas ?? [],
    },
    hairTexture: hairTexture(d),
    beautyAdvice: beautyAdvice(d),
  } as DiagnosticResult;
}
