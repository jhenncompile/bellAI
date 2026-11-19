import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { atelierRadii, atelierShadows, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';

export type AtelierButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

interface AtelierButtonProps {
  title: string;
  onPress: () => void;
  variant?: AtelierButtonVariant;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}

/**
 * Botón cálido reutilizable (equivalente a `CustomButton` / `CustomPrimaryButton` / `CustomDangerButton`).
 */
export const AtelierButton: React.FC<AtelierButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  compact = false,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  const isDisabled = disabled || loading;

  const containerVariantStyle = (() => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryContainer;
      case 'outline':
        return styles.outlineContainer;
      case 'danger':
        return styles.dangerContainer;
      case 'ghost':
        return styles.ghostContainer;
      case 'primary':
      default:
        return styles.primaryContainer;
    }
  })();

  const textVariantStyle = (() => {
    switch (variant) {
      case 'secondary':
      case 'outline':
        return styles.darkText;
      case 'danger':
        return styles.dangerText;
      case 'ghost':
        return styles.terracottaText;
      case 'primary':
      default:
        return styles.lightText;
    }
  })();

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.baseContainer,
        compact ? styles.compactPadding : styles.regularPadding,
        containerVariantStyle,
        isDisabled && styles.disabledContainer,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? atelierColors.surfaceWhite : atelierColors.terracotta}
        />
      ) : (
        <>
          {typeof icon === 'string' ? (
            <Text style={[styles.baseText, compact && styles.compactText, textVariantStyle]}>
              {icon}  {title}
            </Text>
          ) : (
            <>
              {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
              <Text style={[styles.baseText, compact && styles.compactText, textVariantStyle]}>
                {title}
              </Text>
            </>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  baseContainer: {
    borderRadius: atelierRadii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  regularPadding: {
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  compactPadding: {
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  primaryContainer: {
    backgroundColor: atelierColors.terracotta,
    ...atelierShadows.primaryButton,
  },
  secondaryContainer: {
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
  },
  outlineContainer: {
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
  },
  dangerContainer: {
    backgroundColor: atelierColors.burgundyLight,
    borderWidth: 1,
    borderColor: atelierColors.burgundyBorder,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  disabledContainer: {
    opacity: 0.58,
  },
  baseText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  compactText: {
    fontSize: 12.5,
  },
  lightText: {
    color: atelierColors.onAccent,
  },
  darkText: {
    color: atelierColors.espresso,
  },
  dangerText: {
    color: atelierColors.burgundy,
  },
  terracottaText: {
    color: atelierColors.terracottaDark,
  },
});
