import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme, typography, spacing, radius } from '@/shared/theme';

interface AuraHeroHeaderProps { userName?: string; seasonLabel?: string }

export const AuraHeroHeader: React.FC<AuraHeroHeaderProps> = ({ userName, seasonLabel }) => {
  const { isDark, toggleTheme, colors } = useTheme();
  const firstName = userName?.trim().split(/\s+/)[0];
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={[typography.smallStrong, { color: colors.text.secondary }]}>BellAI · Tu espacio personal</Text>
        <Text accessibilityRole="header" style={[typography.h2, { color: colors.text.primary }]}>
          {firstName ? `Hola, ${firstName}` : 'Tu estilo, a tu manera'}
        </Text>
        {seasonLabel ? <Text style={[typography.small, { color: colors.text.secondary }]}>{seasonLabel}</Text> : null}
      </View>
      <TouchableOpacity accessibilityRole="button"
        accessibilityLabel={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}
        onPress={toggleTheme} style={[styles.themeButton, { borderColor: colors.border.subtle, backgroundColor: colors.surface.solid }]}>
        {isDark ? <Sun size={20} color={colors.text.primary} /> : <Moon size={20} color={colors.text.primary} />}
      </TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  copy: { flex: 1, gap: spacing.xs },
  themeButton: { width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});
