import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { componentShapes } from '@/shared/theme/tokens/shapes';
import { useTheme } from '@/shared/theme';
import { NoticeOutlet } from './Notice';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Nombre accesible de la hoja. */
  accessibilityLabel: string;
  children: React.ReactNode;
}

/**
 * Hoja inferior para decisiones breves (filtros, motivos, resultados).
 * Se cierra pulsando el velo o con el gesto de retroceso del sistema.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, accessibilityLabel, children }) => {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlay }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(450).reduceMotion(ReduceMotion.System)}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.sheet,
            shadows.sheet,
            {
              backgroundColor: colors.surface.modal,
              paddingBottom: 30 + insets.bottom,
              borderTopLeftRadius: componentShapes.sheet,
              borderTopRightRadius: componentShapes.sheet,
            },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: colors.border.medium }]} />
          {children}
        </Animated.View>
      </View>
      <NoticeOutlet />
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 14,
  },
  grab: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
});
