import React from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { componentShapes } from '@/shared/theme/tokens/shapes';
import { typography, useTheme } from '@/shared/theme';
import { AccentTitle } from './AccentTitle';
import { Mascot, type MascotPose } from './coral';
import { NoticeOutlet } from './Notice';

export interface DialogProps {
  visible: boolean;
  onClose: () => void;
  /** Texto antes de la palabra destacada del título. */
  titlePrefix?: string;
  /** Palabra destacada del título. */
  titleAccent: string;
  titleSuffix?: string;
  description?: string;
  /** Contenido adicional (casilla de confirmación, por ejemplo). */
  children?: React.ReactNode;
  /** Botones de acción: la que confirma primero y «Cancelar» debajo. */
  actions: React.ReactNode;
  /** Pose de la mascota sobre el título (opcional). */
  mascot?: MascotPose;
}

/** Diálogo centrado (sistema P1): mascota opcional, título, texto y botones alineados al centro. */
export const Dialog: React.FC<DialogProps> = ({
  visible,
  onClose,
  titlePrefix,
  titleAccent,
  titleSuffix,
  description,
  children,
  actions,
  mascot,
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Sube el diálogo cuando aparece el teclado (por ejemplo, el campo de contraseña al borrar la cuenta). */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
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
          entering={ZoomIn.duration(300).reduceMotion(ReduceMotion.System)}
          accessibilityViewIsModal
          style={[
            styles.dialog,
            { backgroundColor: colors.surface.modal, borderRadius: componentShapes.dialog },
          ]}
        >
          {mascot ? <Mascot pose={mascot} height={96} enter="pop" style={styles.mascot} /> : null}
          <AccentTitle variant="h2" align="center" prefix={titlePrefix} accent={titleAccent} suffix={titleSuffix} />
          {description ? (
            <Text style={[typography.body, styles.center, { color: colors.text.secondary }]}>{description}</Text>
          ) : null}
          {children}
          <View style={styles.actions}>{actions}</View>
        </Animated.View>
      </KeyboardAvoidingView>
      <NoticeOutlet />
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    padding: 24,
    gap: 14,
    alignItems: 'stretch',
    boxShadow: '0px 20px 40px rgba(42, 23, 20, 0.25)',
  },
  mascot: { alignSelf: 'center' },
  center: { textAlign: 'center' },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
