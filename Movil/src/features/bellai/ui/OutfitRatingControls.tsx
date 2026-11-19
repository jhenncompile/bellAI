import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { coralText, useCoral } from '@/shared/ui/coral';
import { hapticFeedback } from '@/shared/lib/haptics';
import type { OutfitRating } from '../api/types';
import { FEEDBACK_TO_RATING, RATING_LABEL, RATING_TO_FEEDBACK } from '../model/outfitRating';
import { FeedbackBar } from './components';

const LABELS = { me_gusta: RATING_LABEL.agradable, neutral: RATING_LABEL.neutral, no_me_gusta: RATING_LABEL.no_agradable };

/** HU-22: estrella para marcar una combinación como favorita. Botón redondo de 44 px. */
export function FavoriteButton({ active, onPress, subject, busy }: {
  active: boolean;
  onPress: () => void;
  /** Qué se marca, para el lector de pantalla */
  subject: string;
  busy?: boolean;
}) {
  const c = useCoral();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? `Quitar ${subject} de favoritas` : `Marcar ${subject} como favorita`}
      accessibilityState={{ selected: active, busy: Boolean(busy) }}
      disabled={busy}
      onPress={() => {
        hapticFeedback.light();
        onPress();
      }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.round,
        { borderColor: active ? c.ink : c.fieldStroke, backgroundColor: active ? c.primary : c.card },
        (pressed || busy) && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={active ? c.onPrimary : c.ink} />
      ) : (
        <Star size={19} color={active ? c.onPrimary : c.ink} fill={active ? c.onPrimary : 'transparent'} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

/** HU-22: valoración agradable / neutral / no agradable con el texto de la elegida. */
export function RatingBar({ value, onChange, subject, disabled, hint }: {
  value: OutfitRating | null | undefined;
  onChange: (r: OutfitRating) => void;
  subject: string;
  disabled?: boolean;
  /** Texto cuando aún no se valoró */
  hint?: string;
}) {
  const c = useCoral();
  return (
    <View style={styles.rating}>
      <Text accessibilityLiveRegion="polite" style={[coralText.small, styles.flex, { color: c.ink2 }]}>
        {value ? `Valoración: ${RATING_LABEL[value]}` : (hint ?? '¿Qué te parece?')}
      </Text>
      <FeedbackBar
        value={value ? RATING_TO_FEEDBACK[value] : null}
        onChange={(v) => onChange(FEEDBACK_TO_RATING[v])}
        subject={subject}
        disabled={disabled}
        labels={LABELS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
