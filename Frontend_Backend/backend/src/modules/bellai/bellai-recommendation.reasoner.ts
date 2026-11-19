import { Injectable } from '@nestjs/common';
import { ConsideredFactor } from './entities/bellai-outfit.entity';
import { UserBeautyContext } from './bellai-context.builder';
import { ExplainRecommendationDto } from './dto/bellai.dto';

export interface RecommendationExplanation {
  reasonSummary: string;
  consideredFactors: ConsideredFactor[];
  basedOnRealData: boolean;
  missingContextHints: string[];
}

@Injectable()
export class BellaiRecommendationReasoner {
  explain(
    context: UserBeautyContext,
    input: Partial<ExplainRecommendationDto>,
  ): RecommendationExplanation {
    const factors: ConsideredFactor[] = [];
    const missingHints: string[] = [];
    const fragments: string[] = [];

    if (context.diagnostic) {
      const { seasonalPalette, undertone, faceShape, skinTone } = context.diagnostic;
      factors.push({
        category: 'colorimetria',
        label: 'Colorimetría',
        value: `${seasonalPalette} · Subtono ${undertone} (${skinTone})`,
      });
      factors.push({
        category: 'rostro',
        label: 'Forma de rostro',
        value: faceShape,
      });

      if (input.colors && input.colors.length > 0) {
        fragments.push(
          `los tonos ${input.colors.slice(0, 3).join(', ')} armonizan con tu estación ${seasonalPalette} y subtono ${undertone}`,
        );
      } else {
        fragments.push(
          `armoniza con tu estación ${seasonalPalette}, tu subtono ${undertone} y equilibra tu rostro ${faceShape.toLowerCase()}`,
        );
      }
    } else {
      missingHints.push('Completa tu análisis facial para afinar la colorimetría y el visagismo.');
    }

    const matchedGarments = this.matchGarments(context, input.garmentIds);
    if (matchedGarments.length > 0) {
      const names = matchedGarments.map((g) => g.name).slice(0, 4);
      factors.push({
        category: 'armario',
        label: 'Prendas de tu armario',
        value: names.join(', '),
      });
      fragments.push(`aprovecha prendas reales de tu armario (${names.join(', ')})`);
    } else if (context.wardrobe.totalItems > 0) {
      const topColors = context.wardrobe.colors.slice(0, 4);
      factors.push({
        category: 'armario',
        label: 'Tu armario',
        value: `${context.wardrobe.totalItems} prendas${topColors.length ? ` (${topColors.join(', ')})` : ''}`,
      });
      fragments.push(
        `se integra con las ${context.wardrobe.totalItems} prendas y colores (${topColors.join(', ') || 'neutros'}) que ya tienes en tu armario`,
      );
    } else {
      missingHints.push('Registra prendas en tu armario para recibir combinaciones con tu ropa real.');
    }

    if (context.preferences.preferredStyles.length > 0) {
      const styles = context.preferences.preferredStyles.slice(0, 3).join(', ');
      factors.push({
        category: 'estilo',
        label: 'Tu estilo preferido',
        value: styles,
      });
      fragments.push(`respeta tu preferencia por el estilo ${styles}`);
    }

    const occasion = input.occasion || context.preferences.occasions[0];
    if (occasion) {
      factors.push({
        category: 'ocasion',
        label: 'Ocasión',
        value: occasion,
      });
      fragments.push(`está pensada para ${occasion.toLowerCase()}`);
    }

    const subject = input.title?.trim() || 'Esta recomendación';
    const reasonSummary =
      fragments.length > 0
        ? `${subject} te favorece porque ${this.joinSpanishList(fragments)}.`
        : `${subject} se generó con tu perfil básico de BellAI; agrega tus preferencias o análisis facial para personalizar aún más cada motivo.`;

    return {
      reasonSummary,
      consideredFactors: factors,
      basedOnRealData: factors.length > 0,
      missingContextHints: missingHints,
    };
  }

  private matchGarments(context: UserBeautyContext, garmentIds?: string[]) {
    if (!garmentIds || garmentIds.length === 0) return [];
    const wanted = new Set(garmentIds);
    return context.wardrobe.items.filter((item) => wanted.has(item.id));
  }

  private joinSpanishList(parts: string[]): string {
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  }
}
