import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AtelierPalette,
  atelierSpacing,
  atelierTypography,
  useAtelierPalette,
} from '../theme/atelierTheme';
import { ms } from '@/shared/theme/tokens/responsive';

interface AtelierScreenProps {
  subtitle?: string;
  title?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  /** Se mantienen por compatibilidad: el desplazamiento y refresco lo gestiona la pantalla anfitriona. */
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Contenedor en flujo del Armario Digital. Va dentro del `ScreenContainer` global de la app,
 * por eso no crea su propio ScrollView ni SafeArea: solo pinta el encabezado y el contenido.
 */
export const AtelierScreen: React.FC<AtelierScreenProps> = ({
  subtitle,
  title,
  rightSlot,
  children,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);

  return (
    <View style={styles.root}>
      {subtitle || title || rightSlot ? (
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
          </View>
          {rightSlot ? <View>{rightSlot}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
};

const createStyles = (atelierColors: AtelierPalette) =>
  StyleSheet.create({
    root: {
      paddingHorizontal: atelierSpacing.lg,
      paddingTop: atelierSpacing.sm,
      paddingBottom: 110,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: atelierSpacing.md,
    },
    headerTextCol: {
      flex: 1,
      paddingRight: atelierSpacing.sm,
    },
    subtitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: atelierColors.taupe,
      marginBottom: 2,
    },
    title: {
      fontFamily: atelierTypography.serifFamily,
      fontSize: ms(26),
      fontWeight: '700',
      color: atelierColors.espresso,
      lineHeight: 32,
    },
  });
