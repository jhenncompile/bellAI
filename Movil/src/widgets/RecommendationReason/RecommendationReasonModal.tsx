import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { CalendarDays, Palette, ScanFace, Shirt, Sparkles, X } from 'lucide-react-native';
import { BottomSheet } from '@/shared/ui';
import {
  CoralButton,
  CoralCard,
  CoralIconBox,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import type { ConsideredFactorItem } from '@/features/bellai/storage/bellaiHistoryStorage';

/** Tinta fija sobre los iconos pastel. */
const TILE_INK = '#2A1714';

const FACTOR: Record<ConsideredFactorItem['category'], { Icon: LucideIcon; tile: 0 | 1 | 2 | 3 }> = {
  colorimetria: { Icon: Palette, tile: 0 },
  rostro: { Icon: ScanFace, tile: 1 },
  armario: { Icon: Shirt, tile: 2 },
  estilo: { Icon: Sparkles, tile: 3 },
  ocasion: { Icon: CalendarDays, tile: 0 },
};

export interface RecommendationReasonModalProps {
  visible: boolean;
  onClose: () => void;
  recommendationTitle: string;
  reasonSummary: string;
  consideredFactors: ConsideredFactorItem[];
  contextSummary?: string;
}

/** Hoja inferior (sistema P1) que explica por qué se hizo una recomendación y qué datos tuyos se usaron. */
export const RecommendationReasonModal: React.FC<RecommendationReasonModalProps> = ({
  visible,
  onClose,
  recommendationTitle,
  reasonSummary,
  consideredFactors,
  contextSummary,
}) => {
  const c = useCoral();
  const { height } = useWindowDimensions();

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Motivo de la recomendación">
      <View style={styles.header}>
        <View style={styles.flex}>
          <CoralTitle prefix="¿Por qué te lo " accent="recomendamos?" size={24} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar motivo de la recomendación"
          onPress={onClose}
          hitSlop={4}
          style={({ pressed }) => [styles.close, { backgroundColor: c.muted }, pressed && { opacity: 0.7 }]}
        >
          <X size={20} color={c.ink} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView style={{ maxHeight: Math.round(height * 0.58) }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {recommendationTitle ? (
          <View style={styles.block}>
            <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.ink2 }]}>Recomendación</Text>
            <Text style={[coralText.strong, { fontSize: 16.5, color: c.ink }]}>{recommendationTitle}</Text>
            {contextSummary ? <Text style={[coralText.caption, { fontSize: 13, color: c.ink2 }]}>Según tu perfil: {contextSummary}</Text> : null}
          </View>
        ) : null}

        {reasonSummary ? (
          <CoralCard radius={22} padding={14}>
            <Text style={[coralText.body, { fontSize: 15, color: c.ink }]}>{reasonSummary}</Text>
          </CoralCard>
        ) : null}

        <View style={styles.block}>
          <Text accessibilityRole="header" style={[coralText.label, { color: c.ink }]}>Lo que tuvimos en cuenta</Text>
          {consideredFactors.length > 0 ? (
            <CoralCard radius={22} padding={0} style={styles.list}>
              {consideredFactors.map((factor, idx) => {
                const meta = FACTOR[factor.category] ?? FACTOR.estilo;
                return (
                  <View
                    key={`${factor.category}-${idx}`}
                    style={[styles.factor, idx < consideredFactors.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.fieldStroke }]}
                  >
                    <CoralIconBox gradient={c.tiles[meta.tile]}>
                      <meta.Icon size={20} color={TILE_INK} strokeWidth={2.2} />
                    </CoralIconBox>
                    <View style={styles.flex}>
                      <Text style={[coralText.label, { color: c.ink }]}>{factor.label}</Text>
                      <Text style={[coralText.small, { color: c.ink2 }]}>{factor.value}</Text>
                    </View>
                  </View>
                );
              })}
            </CoralCard>
          ) : (
            <Text style={[coralText.small, { color: c.ink2 }]}>
              Haz tu análisis y guarda prendas en tu armario para que tus recomendaciones tengan en cuenta más datos tuyos.
            </Text>
          )}
        </View>
      </ScrollView>

      <CoralButton title="Entendido" onPress={onClose} fullWidth />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scroll: { gap: 14, paddingBottom: 4 },
  block: { gap: 6 },
  list: { paddingHorizontal: 14 },
  factor: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
