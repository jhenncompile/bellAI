import type { ColorSeason, ContrastLevel, Undertone } from './types';

const ACCENTS: Record<string, string> = {
  Otono: 'Otoño',
  Frio: 'Frío',
  Calido: 'Cálido',
};

const withAccents = (text: string): string =>
  text.replace(/\b(Otono|Frio|Calido)\b/g, (word) => ACCENTS[word] ?? word);

/**
 * Convierte la estación del análisis (por ejemplo «Otono Calido (True Autumn)») en un
 * título legible dividido en dos partes: «Otoño» y «Cálido». La parte final se muestra
 * en cursiva con color de acento. Si la estación tiene una sola palabra, `lead` queda vacío.
 */
export function seasonTitleParts(season: ColorSeason | string): { lead: string; accent: string } {
  const words = withAccents(season.replace(/\s*\(.*?\)\s*/g, ' ').trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lead: '', accent: '' };
  const accent = words[words.length - 1];
  const lead = words.slice(0, -1).join(' ');
  return { lead: lead ? `${lead} ` : '', accent };
}

/** «Subtono cálido · contraste medio». */
export function toneSummary(undertone: Undertone, contrast: ContrastLevel): string {
  return `Subtono ${withAccents(undertone).toLowerCase()} · contraste ${contrast.toLowerCase()}`;
}
