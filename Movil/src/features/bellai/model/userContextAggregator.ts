import { getUserProfile } from '@/entities/user/model/storage';
import { offlineSyncStorage } from '@/features/digital-wardrobe/storage/offlineSyncStorage';
import { wardrobeService } from '@/features/digital-wardrobe/services/wardrobeService';
import type { DiagnosticResult } from '@/entities/diagnostic/model/types';
import type { ConsideredFactorItem } from '../storage/bellaiHistoryStorage';
import { bellaiHistoryStorage } from '../storage/bellaiHistoryStorage';

export interface MobileUserFullContext {
  userName: string;
  goals: string[];
  preferredStyles: string[];
  dislikedStyles: string[];
  occasions: string[];
  diagnostic: DiagnosticResult | null;
  wardrobeItems: Array<{
    id: string;
    name: string;
    category: string;
    subcategory: string;
    color: string;
    season?: string | null;
    occasion?: string | null;
  }>;
  wardrobeColors: string[];
}

export interface RecommendationReasonResult {
  title: string;
  reasonSummary: string;
  consideredFactors: ConsideredFactorItem[];
  contextBadgeText: string;
}

export async function gatherFullUserContext(
  activeDiagnostic?: DiagnosticResult | null,
): Promise<MobileUserFullContext> {
  const [profile, syncSnapshot, storedDiagnostics] = await Promise.all([
    getUserProfile(),
    offlineSyncStorage.getSyncSnapshot().catch(() => null),
    bellaiHistoryStorage.listDiagnostics().catch(() => []),
  ]);

  let rawWardrobe = syncSnapshot?.wardrobe?.items || [];
  if (rawWardrobe.length === 0) {
    try {
      const remoteWardrobe = await wardrobeService.getWardrobe({});
      rawWardrobe = remoteWardrobe.data?.items || [];
    } catch {
      rawWardrobe = [];
    }
  }

  const wardrobeItems = rawWardrobe.map((item: any) => ({
    id: String(item.id),
    name:
      item.name?.trim() ||
      `${item.subcategoryLabel || item.subcategory || item.category} ${item.color || ''}`.trim(),
    category: String(item.categoryLabel || item.category || 'Prenda'),
    subcategory: String(item.subcategoryLabel || item.subcategory || ''),
    color: String(item.color || '').trim(),
    season: item.season || null,
    occasion: item.occasion || null,
  }));

  const colorSet = new Set<string>();
  wardrobeItems.forEach((g: { color?: string | null }) => {
    if (g.color) colorSet.add(g.color);
  });

  const diagnostic = activeDiagnostic || storedDiagnostics[0]?.diagnostic || null;

  return {
    userName: profile.name || 'Usuaria',
    goals: profile.goals || [],
    preferredStyles: profile.preferredStyles || [],
    dislikedStyles: profile.dislikedStyles || [],
    occasions: profile.occasions || [],
    diagnostic,
    wardrobeItems,
    wardrobeColors: Array.from(colorSet),
  };
}

export function formatContextSummaryLine(ctx: MobileUserFullContext): string {
  const parts: string[] = [];
  if (ctx.diagnostic) {
    parts.push(`${ctx.diagnostic.season}`);
    parts.push(`Rostro ${ctx.diagnostic.faceShape}`);
    parts.push(`Subtono ${ctx.diagnostic.undertone}`);
  }
  if (ctx.wardrobeItems.length > 0) {
    const sampleColors = ctx.wardrobeColors.slice(0, 3).join(', ');
    parts.push(
      `${ctx.wardrobeItems.length} prendas${sampleColors ? ` (${sampleColors})` : ''}`,
    );
  } else {
    parts.push('Armario sin prendas aún');
  }
  if (ctx.preferredStyles.length > 0) {
    parts.push(ctx.preferredStyles.slice(0, 2).join(' · '));
  }
  return parts.join(' · ');
}

export function buildDetailedPromptWithUserContext(
  userQuestion: string,
  ctx: MobileUserFullContext,
): string {
  const details: string[] = [];
  if (ctx.diagnostic) {
    const paletteNames = (ctx.diagnostic.palette || [])
      .map((p) => p.name)
      .slice(0, 6)
      .join(', ');
    const avoidNames = (ctx.diagnostic.toxicColors || [])
      .map((t) => t.name)
      .slice(0, 4)
      .join(', ');
    details.push(
      `Colorimetría: estación ${ctx.diagnostic.season}, tono de piel ${ctx.diagnostic.skinTone}, subtono ${ctx.diagnostic.undertone}, contraste ${ctx.diagnostic.contrastLevel}, rostro ${ctx.diagnostic.faceShape}. Paleta ideal: ${paletteNames || 'tonos armónicos'}. Evitar: ${avoidNames || 'ninguno'}.`,
    );
  }
  if (ctx.preferredStyles.length > 0) {
    details.push(`Estilos preferidos: ${ctx.preferredStyles.join(', ')}.`);
  }
  if (ctx.occasions.length > 0) {
    details.push(`Ocasiones habituales: ${ctx.occasions.join(', ')}.`);
  }
  if (ctx.goals.length > 0) {
    details.push(`Objetivos: ${ctx.goals.join(', ')}.`);
  }
  if (ctx.wardrobeItems.length > 0) {
    const itemsText = ctx.wardrobeItems
      .slice(0, 18)
      .map(
        (i) =>
          `${i.name}${i.color ? ` (${i.color})` : ''}${i.occasion ? ` [${i.occasion}]` : ''}`,
      )
      .join(', ');
    details.push(
      `Armario (${ctx.wardrobeItems.length} prendas, colores: ${ctx.wardrobeColors.join(', ')}): ${itemsText}.`,
    );
  }

  return details.length > 0
    ? `${userQuestion}\n\n[Contexto de la usuaria: ${details.join(' ')}]`
    : userQuestion;
}

export function buildLocalRecommendationReason(
  ctx: MobileUserFullContext,
  options: {
    title: string;
    category?: 'colorimetria' | 'rostro' | 'armario' | 'estilo' | 'general';
    items?: string[];
    occasion?: string;
  },
): RecommendationReasonResult {
  const factors: ConsideredFactorItem[] = [];
  const reasons: string[] = [];

  if (ctx.diagnostic) {
    const palettePreview = (ctx.diagnostic.palette || [])
      .slice(0, 3)
      .map((p) => p.name)
      .join(', ');
    factors.push({
      category: 'colorimetria',
      label: 'Colorimetría y piel',
      value: `${ctx.diagnostic.season} · Tono ${ctx.diagnostic.skinTone} · Subtono ${ctx.diagnostic.undertone}${palettePreview ? ` (${palettePreview})` : ''}`,
    });
    factors.push({
      category: 'rostro',
      label: 'Visagismo y rostro',
      value: `Rostro ${ctx.diagnostic.faceShape} · Contraste ${ctx.diagnostic.contrastLevel}`,
    });
    reasons.push(
      `armoniza con la luminosidad de tu estación ${ctx.diagnostic.season} (subtono ${ctx.diagnostic.undertone.toLowerCase()}) y equilibra las proporciones de tu rostro ${ctx.diagnostic.faceShape.toLowerCase()}`,
    );
  }

  if (ctx.wardrobeItems.length > 0) {
    const sampleNames = ctx.wardrobeItems
      .slice(0, 3)
      .map((g) => g.name)
      .join(', ');
    const colorsText = ctx.wardrobeColors.slice(0, 4).join(', ');
    factors.push({
      category: 'armario',
      label: 'Tu armario y prendas',
      value: `${ctx.wardrobeItems.length} prendas registradas (${sampleNames}${colorsText ? ` · colores: ${colorsText}` : ''})`,
    });
    reasons.push(
      `se combina fácilmente con las ${ctx.wardrobeItems.length} prendas y colores (${colorsText || 'neutros'}) que tienes en tu armario`,
    );
  }

  if (ctx.preferredStyles.length > 0) {
    const stylesText = ctx.preferredStyles.slice(0, 3).join(', ');
    factors.push({
      category: 'estilo',
      label: 'Tu estilo y objetivos',
      value: `${stylesText}${ctx.goals.length ? ` · ${ctx.goals[0]}` : ''}`,
    });
    reasons.push(`refleja tu preferencia por el estilo ${stylesText}`);
  }

  const occasionVal = options.occasion || ctx.occasions[0];
  if (occasionVal) {
    factors.push({
      category: 'ocasion',
      label: 'Ocasiones de uso',
      value: occasionVal,
    });
    reasons.push(`se adapta a tus ocasiones de ${occasionVal.toLowerCase()}`);
  }

  const joined =
    reasons.length === 0
      ? 'se basa en tu perfil personal en BellAI.'
      : reasons.length === 1
      ? `${reasons[0]}.`
      : `${reasons.slice(0, -1).join(', ')} y ${reasons[reasons.length - 1]}.`;

  return {
    title: options.title,
    reasonSummary: `Seleccionamos "${options.title}" para ti porque ${joined}`,
    consideredFactors: factors,
    contextBadgeText: formatContextSummaryLine(ctx),
  };
}
