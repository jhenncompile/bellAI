import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Garment } from '../model/types';
import { Card, Badge } from '@/shared/ui';
import { colors, typography, radius, spacing } from '@/shared/theme';

interface GarmentCardProps {
  garment: Garment;
}

export const GarmentCard: React.FC<GarmentCardProps> = ({ garment }) => {
  const getBadgeVariant = (match: Garment['seasonMatch']) => {
    switch (match) {
      case 'Armonia Total':
        return 'success';
      case 'Aceptable':
        return 'accent';
      default:
        return 'secondary';
    }
  };

  return (
    <Card variant="glass" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.colorIndicatorRow}>
          <View
            style={[styles.colorDot, { backgroundColor: garment.primaryColorHex }]}
          />
          <View>
            <Text style={[typography.h4, styles.title]}>{garment.name}</Text>
            <Text style={[typography.bodySmall, styles.category]}>
              {garment.category} • {garment.colorName}
            </Text>
          </View>
        </View>

        <Badge
          label={garment.seasonMatch}
          variant={getBadgeVariant(garment.seasonMatch)}
        />
      </View>

      <Text style={[typography.bodySmall, styles.tips]}>{garment.tips}</Text>

      <View style={styles.footer}>
        <Text style={[typography.caption, styles.scoreLabel]}>
          COMPATIBILIDAD CON TU ESTACIÓN
        </Text>
        <Text style={[typography.h4, styles.scoreValue]}>
          {garment.compatibilityScore}%
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  colorIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    marginRight: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    color: colors.text.primary,
  },
  category: {
    color: colors.text.muted,
  },
  tips: {
    color: colors.text.secondary,
    lineHeight: 18,
    marginVertical: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  scoreLabel: {
    color: colors.text.muted,
    fontSize: 11,
  },
  scoreValue: {
    color: colors.brand.primaryLight,
  },
});
