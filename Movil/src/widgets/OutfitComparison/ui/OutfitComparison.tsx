import React from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Sparkles, TriangleAlert } from 'lucide-react-native';
import { Appear, CoralCard, CoralLink, coralFonts, coralText, useCoral } from '@/shared/ui/coral';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';
import { ScoreBar } from '@/features/bellai/ui/components';

export interface ComparisonPiece {
  key: string;
  /** «Arriba», «Calzado»… */
  role: string;
  name: string;
  color?: string | null;
  colorHex?: string | null;
  photoUrl?: string | null;
}

export interface ComparisonOption {
  key: string;
  title: string;
  /** Texto de la puntuación («Buena combinación · 72/100»); sin puntuación se omite */
  scoreLabel?: string | null;
  pieces: ComparisonPiece[];
  /** Motivo: por qué se propone */
  reasons: string[];
  /** Lo que conviene tener en cuenta */
  cautions?: string[];
  /** Factores en los que gana con claridad a las demás */
  winsIn?: string[];
  isWinner?: boolean;
}

interface OutfitComparisonProps {
  options: ComparisonOption[];
  /** Conclusión: cuál conviene más y por qué (o que están parejas) */
  summary?: string | null;
  /** Puntuación por factor; `scores` en el mismo orden que `options` */
  rows?: { factor: string; scores: number[] }[];
  /** Aviso, p. ej. comparación sin conexión */
  note?: string | null;
  onClose?: () => void;
}

/**
 * HU-21: compara dos o más combinaciones a la vez. Cada opción en su columna con sus prendas y su
 * motivo; debajo, la conclusión y la puntuación por factor si el servidor la calculó.
 */
export function OutfitComparison({ options, summary, rows, note, onClose }: OutfitComparisonProps) {
  const c = useCoral();
  const { width } = useWindowDimensions();
  // Dos columnas casi completas a la vista en teléfonos normales; con tres se desliza
  const columnWidth = Math.max(200, Math.min(260, (Math.min(width, 520) - 32 - 36 - 12) / 1.15));

  return (
    <Appear>
      <CoralCard radius={24} style={styles.card}>
        <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>
          Comparación de {options.length} opciones
        </Text>
        {summary ? <Text style={[coralText.body, { color: c.ink }]} accessibilityLiveRegion="polite">{summary}</Text> : null}
        {note ? <Text style={[coralText.small, { color: c.ink2 }]}>{note}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns}>
          {options.map((o) => (
            <View
              key={o.key}
              style={[styles.column, { width: columnWidth, backgroundColor: c.muted, borderColor: o.isWinner ? c.ink : 'transparent' }]}
            >
              <View style={styles.columnHead}>
                <Text style={[coralText.strong, styles.flex, { color: c.ink }]} numberOfLines={2}>{o.title}</Text>
                {o.isWinner ? (
                  <View style={[styles.badge, { backgroundColor: c.card }]}>
                    <Sparkles size={12} color={c.ink} strokeWidth={2.4} />
                    <Text style={[coralText.caption, { color: c.ink, fontFamily: coralFonts.bold }]}>Más conveniente</Text>
                  </View>
                ) : null}
              </View>
              {o.scoreLabel ? <Text style={[coralText.caption, { color: c.ink2, fontFamily: coralFonts.bold }]}>{o.scoreLabel}</Text> : null}

              <View style={styles.pieces}>
                {o.pieces.map((p) => {
                  const uri = EnvConfig.resolveImageUrl(p.photoUrl ?? null);
                  return (
                    <View key={p.key} style={styles.piece} accessible accessibilityLabel={`${p.role}: ${p.name}${p.color ? `, ${p.color}` : ''}`}>
                      {uri ? (
                        <Image source={{ uri }} style={[styles.thumb, { backgroundColor: c.card }]} />
                      ) : (
                        <View style={[styles.thumb, styles.swatch, { backgroundColor: p.colorHex || c.card, borderColor: c.fieldStroke }]} />
                      )}
                      <View style={styles.flex}>
                        <Text style={[coralText.caption, { color: c.ink2, fontFamily: coralFonts.bold }]}>{p.role}</Text>
                        <Text style={[coralText.small, { color: c.ink }]} numberOfLines={2}>{p.name}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={[coralText.label, { color: c.ink }]}>Por qué</Text>
              {o.reasons.length ? (
                o.reasons.map((r) => <Text key={r} style={[coralText.small, { color: c.ink2 }]}>• {r}</Text>)
              ) : (
                <Text style={[coralText.small, { color: c.ink2 }]}>Cumple sin destacar en ningún criterio.</Text>
              )}
              {o.cautions?.map((w) => (
                <View key={w} style={styles.caution}>
                  <TriangleAlert size={14} color="#8A5300" strokeWidth={2.3} />
                  <Text style={[coralText.small, styles.flex, { color: c.ink }]}>{w}</Text>
                </View>
              ))}
              {o.winsIn?.length ? (
                <Text style={[coralText.caption, { color: c.ink, fontFamily: coralFonts.bold }]}>Gana en: {o.winsIn.join(', ').toLowerCase()}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>

        {rows?.length ? (
          <View style={styles.rows}>
            <Text style={[coralText.label, { color: c.ink }]}>Puntuación por criterio</Text>
            {rows.map((row) => (
              <View key={row.factor} style={styles.row}>
                <Text style={[coralText.strong, { color: c.ink }]}>{row.factor}</Text>
                {row.scores.map((s, i) => <ScoreBar key={options[i]?.key ?? i} label={options[i]?.title ?? `Opción ${i + 1}`} value={s} />)}
              </View>
            ))}
          </View>
        ) : null}

        {onClose ? <CoralLink title="Cerrar comparación" underline onPress={onClose} style={styles.close} /> : null}
      </CoralCard>
    </Appear>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 12 },
  columns: { gap: 12, paddingVertical: 2 },
  column: { borderRadius: 20, borderWidth: 2, padding: 14, gap: 8 },
  columnHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pieces: { gap: 8, marginVertical: 2 },
  piece: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 48, height: 56, borderRadius: 12 },
  swatch: { borderWidth: 1 },
  caution: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  rows: { gap: 10 },
  row: { gap: 4 },
  close: { alignSelf: 'center' },
});
