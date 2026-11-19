export const formatPercentage = (value: number): string => {
  return `${Math.round(value)}%`;
};

export const formatScoreLabel = (score: number): { label: string; color: string } => {
  if (score >= 90) return { label: 'Nivel Óptimo', color: '#10B981' };
  if (score >= 80) return { label: 'Armonía Alta', color: '#A855F7' };
  if (score >= 70) return { label: 'Buen Potencial', color: '#3B82F6' };
  if (score >= 55) return { label: 'Mejoras Sugeridas', color: '#F59E0B' };
  return { label: 'Por Definir', color: '#EC4899' };
};
