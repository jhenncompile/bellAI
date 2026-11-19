import React, { useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { atelierRadii, atelierShadows, atelierTypography, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';
import { AtelierButton } from './AtelierButton';

interface PermissionGuideModalProps {
  visible: boolean;
  source: 'camera' | 'gallery' | null;
  rationaleText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal amable que explica a la usuaria por qué se requiere el permiso de Cámara
 * (`android.permission.CAMERA`) o Galería (`android.permission.READ_MEDIA_IMAGES`)
 * antes de invocar el diálogo nativo del sistema operativo (HU-009).
 */
export const PermissionGuideModal: React.FC<PermissionGuideModalProps> = ({
  visible,
  source,
  rationaleText,
  onConfirm,
  onCancel,
}) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  if (!source) return null;

  const isCamera = source === 'camera';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            {isCamera ? (
              <Camera size={26} color={atelierColors.terracotta} />
            ) : (
              <ImageIcon size={26} color={atelierColors.terracotta} />
            )}
          </View>
          <Text style={styles.badge}>
            {isCamera ? 'Permiso de Cámara' : 'Permiso de Galería de Fotos'}
          </Text>
          <Text style={styles.title}>
            {isCamera
              ? 'Fotografía tu prenda en el momento'
              : 'Elige una prenda desde tu galería'}
          </Text>
          <Text style={styles.description}>
            {rationaleText ||
              (isCamera
                ? 'Para escanear tu prenda y mejorar su imagen como en un estudio fotográfico, necesitamos tu permiso para usar la cámara del teléfono.'
                : 'Para seleccionar fotografías de tu almacenamiento y clasificarlas automáticamente en tu armario personal, necesitamos acceso a tu galería de imágenes.')}
          </Text>

          <View style={styles.permissionTechPill}>
            <Text style={styles.permissionTechText}>
              {isCamera
                ? 'Permiso solicitado: CAMERA (Uso exclusivo para tu armario privado)'
                : 'Permiso solicitado: READ_MEDIA_IMAGES / Galería fotográfica'}
            </Text>
          </View>

          <AtelierButton
            title={isCamera ? 'Permitir y abrir cámara' : 'Permitir y abrir galería'}
            onPress={onConfirm}
            style={styles.confirmBtn}
          />
          <AtelierButton
            title="Ahora no"
            variant="ghost"
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 34, 30, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  sheet: {
    width: '100%',
    backgroundColor: atelierColors.bgLinen,
    borderRadius: atelierRadii.xl,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    ...atelierShadows.floatingBar,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: atelierColors.roseBlush,
    borderWidth: 1,
    borderColor: atelierColors.roseDust,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconEmoji: {
    fontSize: 25,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: atelierColors.terracottaDark,
    marginBottom: 4,
  },
  title: {
    fontFamily: atelierTypography.serifFamily,
    fontSize: 21,
    fontWeight: '700',
    color: atelierColors.espresso,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: atelierColors.mocha,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  permissionTechPill: {
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.md,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  permissionTechText: {
    fontSize: 11,
    color: atelierColors.mocha,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmBtn: {
    width: '100%',
    marginBottom: 6,
  },
});
