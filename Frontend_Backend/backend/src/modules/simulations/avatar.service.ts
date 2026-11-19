import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { BellaiService } from '../bellai/bellai.service';
import { signMediaPath } from '../../common/media/signed-url';

export interface AvatarConfig {
  version: string;
  source: 'escaneo' | 'diagnostico' | 'predeterminado';
  bodyType: string | null;
  /** Anchos relativos a la cadera (= 1) medidos en el análisis corporal. */
  proportions: { shoulder: number; waist: number; hip: number; legToBody: number };
  skinHex: string;
  hairHex: string;
  hairLength: 'Corto' | 'Medio' | 'Largo';
  hairStyle: 'Liso' | 'Ondulado' | 'Rizado' | 'Afro' | 'Bob' | 'Pixie' | 'Recogido' | 'Coleta';
  eyeColorHex: string;
  complexion: 'Esbelta' | 'Atlética' | 'Equilibrada' | 'Curvilínea' | 'Plena';
  complexionScale: number;
  heightScale: number;
  bustScale?: number;
  waistScale?: number;
  hipsScale?: number;
  shouldersScale?: number;
  /** HU-023: silueta base del maniquí (la elige la usuaria; la IA solo la recomienda). */
  preset?: AvatarPreset;
  hairFringe?: boolean;
}

export type AvatarPreset = 'rectangulo' | 'pera' | 'reloj' | 'triangulo_invertido' | 'redondo';
export const AVATAR_PRESETS: AvatarPreset[] = ['rectangulo', 'pera', 'reloj', 'triangulo_invertido', 'redondo'];

const PRESET_REASONS: Record<AvatarPreset, string> = {
  rectangulo: 'Tus hombros, cintura y cadera tienen un ancho parecido.',
  pera: 'Tu cadera es más ancha que tus hombros.',
  reloj: 'Tu cintura está marcada y tus hombros y cadera son parejos.',
  triangulo_invertido: 'Tus hombros son más anchos que tu cadera.',
  redondo: 'Tu volumen se concentra en la zona media.',
};

/** Silueta del análisis corporal → silueta base del maniquí (la IA la recomienda, no la impone). */
export function presetFromBodyType(bodyType: string | null | undefined): AvatarPreset | null {
  const v = (bodyType || '').toLowerCase();
  if (!v) return null;
  if (v.includes('invertido')) return 'triangulo_invertido';
  if (v.includes('pera') || v.includes('triángulo') || v.includes('triangulo')) return 'pera';
  if (v.includes('reloj')) return 'reloj';
  if (v.includes('manzana') || v.includes('ovalad') || v.includes('redond')) return 'redondo';
  if (v.includes('rect')) return 'rectangulo';
  return null;
}

export interface AvatarDiagnosisSummary {
  hasDiagnosis: boolean;
  createdAt: string | null;
  skinTone: string | null;
  undertone: string | null;
  bodyType: string | null;
  hairTexture: string | null;
  hairColor: string | null;
  eyeColorDetected: string | null;
}

const DEFAULT: AvatarConfig = {
  version: 'avatar-procedural-1.1.0',
  source: 'predeterminado',
  bodyType: null,
  proportions: { shoulder: 1, waist: 0.75, hip: 1, legToBody: 0.58 },
  skinHex: '#C99A7A',
  hairHex: '#3B2A20',
  hairLength: 'Medio',
  hairStyle: 'Liso',
  eyeColorHex: '#5D4037',
  complexion: 'Equilibrada',
  complexionScale: 1.0,
  heightScale: 1,
};

const ALLOWED_KEYS = [
  'skinHex',
  'hairHex',
  'hairLength',
  'hairStyle',
  'eyeColorHex',
  'complexion',
  'complexionScale',
  'heightScale',
  'bustScale',
  'waistScale',
  'hipsScale',
  'shouldersScale',
  'preset',
  'hairFringe',
];
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const SKIN_TONE_HEX_MAP: Record<string, string> = {
  'muy claro': '#F5D6C6',
  'muy_claro': '#F5D6C6',
  'porcelain': '#F8DDD0',
  'fair': '#F5D6C6',
  'claro': '#E8BEA2',
  'light': '#E8BEA2',
  'medio claro': '#DCAB88',
  'medio_claro': '#DCAB88',
  'medio': '#C99A7A',
  'medium': '#C99A7A',
  'medio oscuro': '#BA865D',
  'medio_oscuro': '#BA865D',
  'tan': '#BA865D',
  'trigueño': '#A8754F',
  'trigueña': '#A8754F',
  'olive': '#A37752',
  'oscuro': '#7A5236',
  'dark': '#7A5236',
  'moreno': '#7A5236',
  'muy oscuro': '#4E3324',
  'profundo': '#3B2417',
  'deep': '#3B2417',
};

const EYE_COLOR_HEX_MAP: Record<string, string> = {
  'marron': '#3E2723',
  'marron oscuro': '#2D1E1B',
  'cafe': '#3E2723',
  'castaño': '#4E342E',
  'avellana': '#5D4037',
  'hazel': '#5D4037',
  'miel': '#B5651D',
  'ambar': '#B5651D',
  'amber': '#B5651D',
  'verde': '#2E7D32',
  'green': '#2E7D32',
  'azul': '#1565C0',
  'blue': '#1565C0',
  'gris': '#78909C',
  'gray': '#78909C',
  'grey': '#78909C',
  'negro': '#1C1917',
  'black': '#1C1917',
};

const HAIR_COLOR_HEX_MAP: Record<string, string> = {
  'negro': '#1C1917',
  'black': '#1C1917',
  'castaño oscuro': '#3B2A20',
  'dark brown': '#3B2A20',
  'castaño medio': '#523B2F',
  'castaño': '#523B2F',
  'brown': '#523B2F',
  'castaño claro': '#6D4C41',
  'light brown': '#6D4C41',
  'rubio oscuro': '#8D6E48',
  'dark blonde': '#8D6E48',
  'rubio dorado': '#CA8A04',
  'golden blonde': '#CA8A04',
  'rubio': '#CA8A04',
  'blonde': '#CA8A04',
  'rubio claro': '#D8C59A',
  'platino': '#E2D9C8',
  'platinum': '#E2D9C8',
  'cobrizo': '#C2410C',
  'pelirrojo': '#C2410C',
  'copper': '#C2410C',
  'red': '#C2410C',
  'borgoña': '#831843',
  'burgundy': '#831843',
  'vino': '#831843',
  'gris': '#9E9E9E',
  'canas': '#9E9E9E',
  'blanco': '#E0E0E0',
};

/**
 * HU-022 / HU-023: avatar 3D procedural y anatómico.
 * Extrae la configuración biométrica real del diagnóstico de la usuaria:
 * proporciones corporales, tono de piel (L*a*b* medido), color de iris,
 * características capilares (color y textura) y silueta, sin valores hardcodeados.
 */
@Injectable()
export class AvatarService {
  constructor(private readonly ds: DataSource, private readonly bellai: BellaiService) {}

  private extractSkinHex(d: any, row: any): string {
    const raw = d?.colorimetry?.skinHex ?? d?.skinHex;
    if (typeof raw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
    const toneText = String(row?.skinTone || d?.colorimetry?.skinTone || d?.skinTone || '').trim().toLowerCase();
    for (const [key, hex] of Object.entries(SKIN_TONE_HEX_MAP)) {
      if (toneText.includes(key)) return hex;
    }
    return DEFAULT.skinHex;
  }

  private extractEyeColorHex(d: any): string {
    const raw = d?.colorimetry?.eyes?.hex ?? d?.face?.eyeColorHex ?? d?.face?.eyes?.hex ?? d?.eyes?.hex;
    if (typeof raw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
    const eyeText = String(d?.eyes?.name || d?.face?.eyeColor || d?.face?.eyes?.color || '').trim().toLowerCase();
    for (const [key, hex] of Object.entries(EYE_COLOR_HEX_MAP)) {
      if (eyeText.includes(key)) return hex;
    }
    return DEFAULT.eyeColorHex;
  }

  private extractHairHex(d: any, hairFeatures: any): string {
    const raw = d?.hair?.baseColor?.hex ?? d?.colorimetry?.hair?.baseColor?.hex ?? hairFeatures?.color_hex ?? hairFeatures?.hex;
    if (typeof raw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
    const hairText = String(d?.hair?.baseColor?.name || d?.colorimetry?.hair?.baseColor?.name || hairFeatures?.color || hairFeatures?.tono || '').trim().toLowerCase();
    for (const [key, hex] of Object.entries(HAIR_COLOR_HEX_MAP)) {
      if (hairText.includes(key)) return hex;
    }
    return DEFAULT.hairHex;
  }

  private extractHairStyle(d: any, hairFeatures: any): AvatarConfig['hairStyle'] {
    const texture = String(
      d?.hair?.texture?.type ||
      d?.colorimetry?.hair?.texture?.type ||
      hairFeatures?.texture?.type ||
      hairFeatures?.textura ||
      hairFeatures?.tipo ||
      '',
    ).trim().toLowerCase();

    if (texture.includes('afro') || texture.includes('kinky') || texture.includes('coily')) return 'Afro';
    if (texture.includes('riz') || texture.includes('curly') || texture.includes('bucle')) return 'Rizado';
    if (texture.includes('ond') || texture.includes('wavy')) return 'Ondulado';
    if (texture.includes('bob')) return 'Bob';
    if (texture.includes('pixie') || texture.includes('muy corto')) return 'Pixie';
    if (texture.includes('recogido') || texture.includes('moño') || texture.includes('bun')) return 'Recogido';
    if (texture.includes('coleta') || texture.includes('cola') || texture.includes('ponytail')) return 'Coleta';
    return 'Liso';
  }

  private extractHairLength(d: any, hairFeatures: any): AvatarConfig['hairLength'] {
    const len = String(d?.hair?.length || d?.colorimetry?.hair?.length || hairFeatures?.longitud || hairFeatures?.length || '').trim().toLowerCase();
    if (len.includes('cort') || len.includes('short')) return 'Corto';
    if (len.includes('larg') || len.includes('long')) return 'Largo';
    return 'Medio';
  }

  private extractComplexionAndScale(
    bodyType: string | null,
    metrics: any,
  ): { complexion: AvatarConfig['complexion']; complexionScale: number; heightScale: number } {
    let complexion: AvatarConfig['complexion'] = 'Equilibrada';
    let complexionScale = 1.0;
    const bt = (bodyType || '').toLowerCase();
    const hip = metrics?.hipWidthPx || 1;
    const waistRatio = metrics ? metrics.waistWidthPx / hip : 0.75;
    const shoulderRatio = metrics ? metrics.shoulderWidthPx / hip : 1.0;

    if (bt.includes('manzana') || bt.includes('ovalada') || waistRatio > 0.88) {
      complexion = 'Plena';
      complexionScale = 1.22;
    } else if (bt.includes('pera') || (bt.includes('triangulo') && !bt.includes('invertido')) || shoulderRatio < 0.88) {
      complexion = 'Curvilínea';
      complexionScale = 1.14;
    } else if (bt.includes('reloj de arena')) {
      complexion = waistRatio < 0.72 ? 'Curvilínea' : 'Equilibrada';
      complexionScale = complexion === 'Curvilínea' ? 1.08 : 1.02;
    } else if (bt.includes('invertido') || shoulderRatio > 1.15) {
      complexion = 'Atlética';
      complexionScale = 1.0;
    } else if (bt.includes('rectang')) {
      const legRatio = metrics?.legToBody ?? 0.58;
      complexion = legRatio > 0.60 ? 'Esbelta' : 'Equilibrada';
      complexionScale = complexion === 'Esbelta' ? 0.92 : 1.0;
    }

    let heightScale = 1.0;
    const leg = metrics?.legToBody ?? 0.58;
    if (leg >= 0.62) heightScale = 1.08;
    else if (leg <= 0.53) heightScale = 0.92;

    return { complexion, complexionScale, heightScale };
  }

  private fromDiagnosis(row: any | null): AvatarConfig {
    if (!row) return { ...DEFAULT };
    const d = row.d ?? row.resultado_detallado ?? null;
    const m = d?.body?.metrics || row.proporciones || null;
    const hip = m?.hipWidthPx || 1;
    const bodyType = d?.body?.bodyType || d?.bodyType || row.bodyType || row.tipo_cuerpo || null;
    const hairFeatures = row.hairFeatures || row.caracteristicas_cabello || null;

    const { complexion, complexionScale, heightScale } = this.extractComplexionAndScale(bodyType, m);

    return {
      ...DEFAULT,
      source: 'diagnostico',
      bodyType: bodyType ?? null,
      proportions: m
        ? {
            shoulder: Math.round(clamp(m.shoulderWidthPx / hip, 0.7, 1.4) * 100) / 100,
            waist: Math.round(clamp(m.waistWidthPx / hip, 0.5, 1.2) * 100) / 100,
            hip: 1,
            legToBody: Math.round(clamp(m.legToBody ?? 0.58, 0.45, 0.7) * 100) / 100,
          }
        : DEFAULT.proportions,
      skinHex: this.extractSkinHex(d, row),
      hairHex: this.extractHairHex(d, hairFeatures),
      hairLength: this.extractHairLength(d, hairFeatures),
      hairStyle: this.extractHairStyle(d, hairFeatures),
      eyeColorHex: this.extractEyeColorHex(d),
      complexion,
      complexionScale,
      heightScale,
    };
  }

  /** Con escaneo (HU-023), las medidas y colores medidos mandan sobre los del diagnóstico. */
  private fromScan(base: AvatarConfig, scan: any): AvatarConfig {
    return {
      ...base,
      version: scan.version ?? base.version,
      source: 'escaneo',
      proportions: scan.proportions ?? base.proportions,
      skinHex: scan.appearance?.skinHex ?? base.skinHex,
      hairHex: scan.appearance?.hairHex ?? base.hairHex,
      hairLength: scan.appearance?.hairLength ?? base.hairLength,
      eyeColorHex: scan.appearance?.eyeColorHex ?? base.eyeColorHex,
    };
  }

  async get(user: User) {
    // 1. Buscar diagnóstico en la tabla principal `diagnostico`
    let [diagRow] = await this.ds.query(
      `SELECT id, forma_rostro AS "faceShape", tono_piel AS "skinTone", subtono_piel AS "undertone",
              paleta_estacional AS "seasonalPalette", tipo_cuerpo AS "bodyType", proporciones,
              caracteristicas_cabello AS "hairFeatures", resultado_detallado AS d, creado_en AS "createdAt"
       FROM diagnostico
       WHERE usuario_id = $1
       ORDER BY creado_en DESC
       LIMIT 1`,
      [user.id],
    );

    // 2. Si no hay en `diagnostico`, buscar en `bellai_diagnostics`
    if (!diagRow) {
      const [fallback] = await this.ds.query(
        `SELECT id, face_shape AS "faceShape", skin_tone AS "skinTone", undertone,
                seasonal_palette AS "seasonalPalette", NULL AS "bodyType", proportions AS proporciones,
                hair_features AS "hairFeatures", details AS d, created_at AS "createdAt"
         FROM bellai_diagnostics
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id],
      );
      diagRow = fallback ?? null;
    }

    const [saved] = await this.ds.query(
      'SELECT configuracion AS c, actualizado_en AS "updatedAt" FROM avatar WHERE usuario_id = $1',
      [user.id],
    );
    const scan = saved?.c?.scan ?? null;
    const fromDiag = this.fromDiagnosis(diagRow);
    const base = scan ? this.fromScan(fromDiag, scan) : fromDiag;
    const custom = saved?.c?.customization ?? {};

    const d = diagRow?.d ?? null;
    const bodyType = fromDiag.bodyType;
    const diagnosisInfo: AvatarDiagnosisSummary | null = diagRow
      ? {
          hasDiagnosis: true,
          createdAt: diagRow.createdAt ? new Date(diagRow.createdAt).toISOString() : null,
          skinTone: diagRow.skinTone ?? d?.colorimetry?.skinTone ?? null,
          undertone: diagRow.undertone ?? d?.colorimetry?.undertone ?? null,
          bodyType,
          hairTexture: d?.hair?.texture?.type ?? d?.colorimetry?.hair?.texture?.type ?? diagRow.hairFeatures?.textura ?? null,
          hairColor: d?.hair?.baseColor?.name ?? diagRow.hairFeatures?.color ?? null,
          eyeColorDetected: d?.colorimetry?.eyes?.hex ?? null,
        }
      : null;

    // La IA recomienda una silueta a partir del análisis corporal; la usuaria decide si la aplica
    // Con escaneo 3D, sus medidas mandan: silueta y ajustes del maniquí salen de ahí (la usuaria puede cambiarlos)
    const fit = (scan?.mannequin ?? {}) as Partial<AvatarConfig>;
    const fitPreset = fit.preset && AVATAR_PRESETS.includes(fit.preset) ? fit.preset : null;
    const recommended = fitPreset ?? presetFromBodyType(bodyType);
    return {
      ...base,
      ...fit,
      ...custom,
      preset: custom.preset ?? recommended ?? 'reloj',
      recommendation: recommended
        ? { preset: recommended, reason: fitPreset ? 'Según las medidas de tu escaneo 3D.' : PRESET_REASONS[recommended] }
        : null,
      customization: custom,
      hasBodyAnalysis: Boolean(diagRow?.d?.body || diagRow?.proporciones),
      diagnosisInfo,
      // La clave de almacenamiento no sale del servidor: la malla se pide a /api/avatar/mesh
      scan: scan
        ? { measurements: scan.measurements, quality: scan.quality, appearance: scan.appearance, createdAt: scan.createdAt }
        : null,
      hint: scan || diagRow?.d?.body || diagRow?.proporciones ? null : 'Realiza tu análisis facial o corporal para calibrar tu avatar con tus rasgos reales.',
      updatedAt: saved?.updatedAt ?? null,
    };
  }

  async save(user: User, customization: Record<string, unknown>) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(customization)) {
      if (!ALLOWED_KEYS.includes(k)) continue;
      if ((k === 'skinHex' || k === 'hairHex' || k === 'eyeColorHex') && !(typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v))) {
        throw new BadRequestException(`${k} debe ser un color #RRGGBB.`);
      }
      if (k === 'hairLength' && !['Corto', 'Medio', 'Largo'].includes(String(v))) {
        throw new BadRequestException('hairLength debe ser Corto, Medio o Largo.');
      }
      if (k === 'hairStyle' && !['Liso', 'Ondulado', 'Rizado', 'Afro', 'Bob', 'Pixie', 'Recogido', 'Coleta'].includes(String(v))) {
        throw new BadRequestException('hairStyle debe ser Liso, Ondulado, Rizado, Afro, Bob, Pixie, Recogido o Coleta.');
      }
      if (k === 'complexion' && !['Esbelta', 'Atlética', 'Equilibrada', 'Curvilínea', 'Plena'].includes(String(v))) {
        throw new BadRequestException('complexion debe ser Esbelta, Atlética, Equilibrada, Curvilínea o Plena.');
      }
      if (k === 'complexionScale' && !(typeof v === 'number' && v >= 0.75 && v <= 1.4)) {
        throw new BadRequestException('complexionScale debe estar entre 0.75 y 1.4.');
      }
      if (k === 'preset' && !AVATAR_PRESETS.includes(String(v) as AvatarPreset)) {
        throw new BadRequestException(`preset debe ser uno de: ${AVATAR_PRESETS.join(', ')}.`);
      }
      if (k === 'hairFringe' && typeof v !== 'boolean') {
        throw new BadRequestException('hairFringe debe ser verdadero o falso.');
      }
      if (k === 'heightScale' && !(typeof v === 'number' && v >= 0.85 && v <= 1.15)) {
        throw new BadRequestException('heightScale debe estar entre 0.85 y 1.15.');
      }
      if (['bustScale', 'waistScale', 'hipsScale', 'shouldersScale'].includes(k) && !(typeof v === 'number' && v >= 0.7 && v <= 1.4)) {
        throw new BadRequestException(`${k} debe ser un número entre 0.7 y 1.4.`);
      }
      clean[k] = v;
    }
    await this.bellai.ensureUser(user);
    await this.ds.query(
      `INSERT INTO avatar (usuario_id, clave_modelo_3d, configuracion) VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (usuario_id) DO UPDATE SET configuracion = COALESCE(avatar.configuracion,'{}'::jsonb) || EXCLUDED.configuracion, actualizado_en = CURRENT_TIMESTAMP`,
      [user.id, `procedural:${user.id}`, JSON.stringify({ customization: clean })],
    );
    return this.get(user);
  }

  /** Prendas del outfit con la zona del avatar donde se colocan. */
  async dress(user: User, outfitId: string) {
    const rows = await this.ds.query(
      `SELECT w.id, w.name, w.category, w.subcategory, w.color, w.color_hex AS "colorHex",
              COALESCE(w.enhanced_image_url, w.original_image_url) AS "imageUrl"
       FROM outfit o JOIN outfit_item oi ON oi.outfit_id = o.id JOIN wardrobe_items w ON w.id = oi.wardrobe_item_id
       WHERE o.id = $1 AND o.usuario_id = $2`,
      [outfitId, user.id],
    );
    if (!rows.length) throw new NotFoundException('No se encontró el outfit o no tiene prendas.');
    const slot = (r: any) =>
      r.subcategory === 'vestidos' ? 'vestido'
        : r.category === 'superior' ? 'torso'
        : r.category === 'inferior' ? (['faldas', 'shorts'].includes(r.subcategory) ? 'cadera' : 'piernas')
        : r.category === 'abrigo' ? 'abrigo'
        : r.category === 'calzado' ? 'pies'
        : 'accesorio';
    return { outfitId, items: rows.map((r: any) => ({ ...r, imageUrl: signMediaPath(r.imageUrl), slot: slot(r), length: ['faldas', 'shorts'].includes(r.subcategory) ? (r.subcategory === 'shorts' ? 'corto' : 'rodilla') : 'largo' })) };
  }
}

