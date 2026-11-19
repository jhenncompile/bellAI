import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profile/entities/profile.entity';
import { Preferences } from '../profile/entities/preferences.entity';
import { WardrobeItem } from '../wardrobe/entities/wardrobe-item.entity';

export interface WardrobeSummaryItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  color: string | null;
  colorHex: string | null;
  season: string | null;
  occasion: string | null;
  wearCount: number;
}

export interface UserBeautyContext {
  userId: string;
  userName: string;
  preferences: {
    goals: string[];
    preferredStyles: string[];
    dislikedStyles: string[];
    occasions: string[];
    preferredColors: string[];
    avoidedColors: string[];
    budgetPerGarment: number | null;
  };
  diagnostic: {
    id: string;
    faceShape: string;
    skinTone: string;
    undertone: string;
    seasonalPalette: string;
    contrastLevel: string | null;
    recommendedPalette: string[];
    toxicColors: string[];
    hairAdvice: Record<string, any>;
    createdAt: Date;
  } | null;
  wardrobe: {
    totalItems: number;
    colors: string[];
    categories: Record<string, number>;
    items: WardrobeSummaryItem[];
  };
}

@Injectable()
export class BellaiContextBuilder {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Preferences)
    private readonly preferencesRepo: Repository<Preferences>,
    @InjectRepository(WardrobeItem)
    private readonly wardrobeRepo: Repository<WardrobeItem>,
    private readonly ds: DataSource,
  ) {}

  async build(userId: string): Promise<UserBeautyContext> {
    const [user, profile, prefs, latestDiagnostic, wardrobeItems] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.profileRepo.findOne({ where: { userId } }),
      this.preferencesRepo.findOne({ where: { userId } }),
      this.latestDiagnostic(userId),
      this.wardrobeRepo.find({
        where: { userId, status: 'confirmed' },
        order: { wearCount: 'DESC', createdAt: 'DESC' },
        take: 60,
      }),
    ]);

    const stylePrefs = prefs?.stylePreferences || {};
    const userName =
      user?.name?.trim() ||
      user?.email?.split('@')[0] ||
      'Usuaria';

    const categories: Record<string, number> = {};
    const colorSet = new Set<string>();
    const items: WardrobeSummaryItem[] = wardrobeItems.map((item) => {
      categories[item.category] = (categories[item.category] || 0) + 1;
      if (item.color) colorSet.add(item.color.trim());
      return {
        id: item.id,
        name: item.name || `${item.subcategory} ${item.color || ''}`.trim(),
        category: item.category,
        subcategory: item.subcategory,
        color: item.color,
        colorHex: item.colorHex,
        season: item.season,
        occasion: item.occasion,
        wearCount: item.wearCount,
      };
    });

    const diagDetails = latestDiagnostic?.details || {};
    const paletteRaw = Array.isArray(diagDetails.palette) ? diagDetails.palette : [];
    const toxicRaw = Array.isArray(diagDetails.recommendations?.colors?.avoid)
      ? diagDetails.recommendations.colors.avoid
      : Array.isArray(diagDetails.toxicColors) ? diagDetails.toxicColors : [];

    return {
      userId,
      userName,
      preferences: {
        goals: Array.isArray(stylePrefs.goals) ? stylePrefs.goals : [],
        preferredStyles: Array.isArray(stylePrefs.preferredStyles) ? stylePrefs.preferredStyles : [],
        dislikedStyles: Array.isArray(stylePrefs.dislikedStyles) ? stylePrefs.dislikedStyles : [],
        occasions: Array.isArray(stylePrefs.occasions) ? stylePrefs.occasions : [],
        preferredColors: Array.isArray(stylePrefs.preferredColors) ? stylePrefs.preferredColors : [],
        avoidedColors: Array.isArray(stylePrefs.avoidedColors) ? stylePrefs.avoidedColors : [],
        budgetPerGarment:
          typeof stylePrefs.budgetPerGarment === 'number' ? stylePrefs.budgetPerGarment : null,
      },
      diagnostic: latestDiagnostic
        ? {
            id: latestDiagnostic.id,
            faceShape: latestDiagnostic.faceShape,
            skinTone: latestDiagnostic.skinTone,
            undertone: latestDiagnostic.undertone,
            seasonalPalette: latestDiagnostic.seasonalPalette,
            contrastLevel:
              typeof diagDetails.contrastLevel === 'string' ? diagDetails.contrastLevel : null,
            recommendedPalette: paletteRaw
              .map((p: any) => (typeof p === 'string' ? p : p?.name || p?.hex))
              .filter(Boolean),
            toxicColors: toxicRaw
              .map((t: any) => (typeof t === 'string' ? t : t?.name || t?.hex))
              .filter(Boolean),
            hairAdvice: latestDiagnostic.hairFeatures || {},
            createdAt: latestDiagnostic.createdAt,
          }
        : null,
      wardrobe: {
        totalItems: items.length,
        colors: Array.from(colorSet),
        categories,
        items,
      },
    };
  }

  /**
   * Último diagnóstico de la usuaria desde la tabla `diagnostico` (pipeline de IA local, HU-005).
   * Al integrar main se sustituyó la lectura de `bellai_diagnostics` para usar una sola fuente.
   */
  private async latestDiagnostic(userId: string) {
    const [row] = await this.ds.query(
      `SELECT id, forma_rostro, tono_piel, subtono_piel, paleta_estacional, caracteristicas_cabello, resultado_detallado, creado_en
       FROM diagnostico WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 1`,
      [userId],
    );
    if (!row) return null;
    return {
      id: row.id as string,
      faceShape: row.forma_rostro || 'sin determinar',
      skinTone: row.tono_piel || 'sin determinar',
      undertone: row.subtono_piel || 'sin determinar',
      seasonalPalette: row.paleta_estacional || 'sin determinar',
      hairFeatures: row.caracteristicas_cabello || {},
      details: row.resultado_detallado || {},
      createdAt: row.creado_en as Date,
    };
  }

  formatPromptContext(ctx: UserBeautyContext): string {
    const lines: string[] = [`Usuaria: ${ctx.userName}`];

    if (ctx.diagnostic) {
      lines.push(
        `Colorimetría y biometría: estación ${ctx.diagnostic.seasonalPalette}, tono de piel ${ctx.diagnostic.skinTone}, subtono ${ctx.diagnostic.undertone}, forma de rostro ${ctx.diagnostic.faceShape}${ctx.diagnostic.contrastLevel ? `, contraste ${ctx.diagnostic.contrastLevel}` : ''}.`,
      );
      if (ctx.diagnostic.recommendedPalette.length > 0) {
        lines.push(`Colores favorables: ${ctx.diagnostic.recommendedPalette.slice(0, 8).join(', ')}.`);
      }
      if (ctx.diagnostic.toxicColors.length > 0) {
        lines.push(`Colores a evitar: ${ctx.diagnostic.toxicColors.slice(0, 6).join(', ')}.`);
      }
    } else {
      lines.push('Colorimetría y biometría: aún no tiene diagnóstico facial registrado.');
    }

    const { preferences } = ctx;
    if (preferences.preferredStyles.length > 0) {
      lines.push(`Estilos preferidos: ${preferences.preferredStyles.join(', ')}.`);
    }
    if (preferences.dislikedStyles.length > 0) {
      lines.push(`Estilos que prefiere evitar: ${preferences.dislikedStyles.join(', ')}.`);
    }
    if (preferences.goals.length > 0) {
      lines.push(`Objetivos de imagen: ${preferences.goals.join(', ')}.`);
    }
    if (preferences.occasions.length > 0) {
      lines.push(`Ocasiones habituales: ${preferences.occasions.join(', ')}.`);
    }
    if (preferences.preferredColors.length > 0) {
      lines.push(`Colores preferidos declarados: ${preferences.preferredColors.join(', ')}.`);
    }

    if (ctx.wardrobe.totalItems > 0) {
      const sampleItems = ctx.wardrobe.items
        .slice(0, 25)
        .map(
          (g) =>
            `${g.name} (${g.category}/${g.subcategory}${g.color ? `, color ${g.color}` : ''}${g.occasion ? `, ocasión ${g.occasion}` : ''})`,
        )
        .join('; ');
      lines.push(
        `Armario digital (${ctx.wardrobe.totalItems} prendas confirmadas, colores disponibles: ${ctx.wardrobe.colors.join(', ') || 'sin especificar'}): ${sampleItems}.`,
      );
    } else {
      lines.push('Armario digital: aún no tiene prendas confirmadas registradas.');
    }

    return lines.join('\n');
  }
}
