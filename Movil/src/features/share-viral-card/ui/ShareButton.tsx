import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Button } from '@/shared/ui';
import { Share2 } from 'lucide-react-native';
import { useTheme } from '@/shared/theme';

export interface ShareButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  variant?: 'gold' | 'primary' | 'secondary' | 'outline';
  style?: StyleProp<ViewStyle>;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  title = 'Compartir mi tarjeta',
  variant = 'primary',
  style,
}) => {
  const { colors } = useTheme();
  return (
    <Button
      title={title}
      onPress={onPress}
      variant={variant}
      size="lg"
      loading={loading}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Abre el menú de aplicaciones instaladas en tu teléfono para compartir la tarjeta de diagnóstico"
      // El botón principal es de tinta: el icono va en blanco (texto inverso).
      icon={<Share2 color={variant === 'primary' || variant === 'gold' ? colors.text.inverse : colors.text.primary} size={18} />}
      style={style}
    />
  );
};
