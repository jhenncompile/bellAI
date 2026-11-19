import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { typography, useTheme } from '@/shared/theme';
import { componentSizes } from '@/shared/theme/tokens/spacing';
import { CardGlass } from './card';

export interface ListRowProps {
  title: string;
  description?: string;
  /** Icono dentro del círculo de 40. */
  icon?: React.ReactNode;
  /** Elemento a la derecha. Por defecto, una flecha si la fila es pulsable. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Texto e icono en color de error, para acciones de riesgo. */
  danger?: boolean;
  /** Dibuja la línea superior que separa esta fila de la anterior. ListCard lo añade solo. */
  divider?: boolean;
  accessibilityHint?: string;
}

/** Fila de lista: icono en círculo, título, descripción opcional y elemento final. */
export const ListRow: React.FC<ListRowProps> = ({
  title,
  description,
  icon,
  trailing,
  onPress,
  danger = false,
  divider = false,
  accessibilityHint,
}) => {
  const { colors } = useTheme();
  const tone = danger ? colors.text.danger : colors.text.primary;

  const body = (
    <>
      {icon ? (
        <View
          accessible={false}
          style={[styles.badge, { backgroundColor: danger ? colors.state.dangerBg : colors.brand.accentSoft }]}
        >
          {icon}
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[typography.bodyStrong, { color: tone }]}>{title}</Text>
        {description ? (
          <Text style={[typography.small, { color: danger ? colors.text.danger : colors.text.secondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={18} color={colors.text.secondary} /> : null)}
    </>
  );

  const containerStyle = [
    styles.row,
    divider && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border.glass },
  ];

  if (!onPress) {
    return <View style={containerStyle}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint ?? description}
      onPress={onPress}
      style={({ pressed }) => [containerStyle, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
};

/** Tarjeta de vidrio que agrupa filas con una línea tenue entre ellas. */
export const ListCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <CardGlass padding="none">
      {items.map((child, index) =>
        index === 0
          ? child
          : React.cloneElement(child as React.ReactElement<ListRowProps>, { divider: true })
      )}
    </CardGlass>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: componentSizes.listRow,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
});
