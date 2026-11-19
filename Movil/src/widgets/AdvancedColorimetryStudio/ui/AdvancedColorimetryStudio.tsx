import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Badge, ProgressBar } from '@/shared/ui';
import {
  MunsellCoordinates,
  ContrastMetric,
  ToxicColor,
  ActionPalettes,
} from '@/entities/diagnostic/model/types';
import { colors, typography, radius, spacing } from '@/shared/theme';
import { hapticFeedback } from '@/shared/lib/haptics';
import {
  Sliders,
  AlertOctagon,
  Briefcase,
  Crown,
  Gem,
} from 'lucide-react-native';

interface AdvancedColorimetryStudioProps {
  seasonName?: string;
  munsell?: MunsellCoordinates;
  contrastMetric?: ContrastMetric;
  toxicColors?: ToxicColor[];
  actionPalettes?: ActionPalettes;
}

export const AdvancedColorimetryStudio: React.FC<AdvancedColorimetryStudioProps> = ({
  seasonName = 'Otoño Cálido',
  munsell = {
    temperatureScore: 75,
    valueScore: 40,
    chromaScore: 65,
    dominantDimension: 'Temperatura Cálida',
  },
  contrastMetric = {
    deltaL: 48,
    level: 'Medio Cálido',
    stylingRule:
      'Favorecen combinaciones ricas y cálidas: terracota, café, mostaza, cobre y verde oliva. Evita looks fríos con contrastes plateados o blanco óptico.',
  },
  toxicColors = [
    {
      hex: '#4F6BED',
      name: 'Azul Frío Eléctrico',
      negativeEffect:
        'Apaga la vitalidad dorada de tu subtono y genera sombras grisáceas bajo los ojos.',
    },
    {
      hex: '#E11D48',
      name: 'Fucsia Helado',
      negativeEffect:
        'Rompe la armonía cálida de tu piel, haciéndola lucir cansada o pálida.',
    },
    {
      hex: '#94A3B8',
      name: 'Gris Plata',
      negativeEffect:
        'Le resta luminosidad a tu iris y deslava la definición natural del rostro.',
    },
  ],
  actionPalettes = {
    baseWardrobe: [
      { hex: '#C97B4A', name: 'Cobre Cálido', category: 'base', usageTip: 'Prendas principales de exterior y blazers' },
      { hex: '#8B5E3C', name: 'Café Profundo', category: 'base', usageTip: 'Pantalones, faldas y calzado estructurado' },
      { hex: '#F2E8DC', name: 'Crema Cálido', category: 'base', usageTip: 'Camisas y blusas cerca al rostro' },
      { hex: '#3E3A36', name: 'Carbón Suave', category: 'neutro', usageTip: 'Excelente alternativa neutra al negro puro' },
    ],
    powerColors: [
      { hex: '#D9A441', name: 'Mostaza / Ocre', category: 'acento', usageTip: 'Tu tono estrella de máxima energía y calidez' },
      { hex: '#7A8450', name: 'Verde Oliva', category: 'acento', usageTip: 'Proyecta balance, sobriedad y serenidad' },
      { hex: '#B5482E', name: 'Rojo Teja', category: 'acento', usageTip: 'Color de alto impacto para eventos clave' },
    ],
    beautyAndMetals: {
      lipsticks: [
        'Terracota cálido aterciopelado',
        'Nude durazno / melocotón',
        'Rojo ladrillo satinado',
        'Canela tostado',
      ],
      metals: ['Oro Amarillo 18k', 'Cobre Pulido', 'Latón Envejecido'],
      glassesFrameColors: ['Carey Habana / Ámbar', 'Cobre Cepillado', 'Acetato Oliva'],
    },
  },
}) => {

  const [activeTab, setActiveTab] = useState<'base' | 'power' | 'beauty'>('base');

  const handleSelectTab = (tab: 'base' | 'power' | 'beauty') => {
    hapticFeedback.light();
    setActiveTab(tab);
  };

  return (
    <Card variant="gradientBorder" style={styles.card}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sliders color={colors.brand.primaryLight} size={20} />
          <Text style={[typography.h3, styles.title]}>
            Colorimetría y Contraste
          </Text>
        </View>
        <Badge label="12 Estaciones" variant="primary" />
      </View>

      <Text style={[typography.bodySmall, styles.subtitle]}>
        Análisis visual basado en las dimensiones del color y tu contraste natural
      </Text>

      {/* 1. SECCIÓN: DIMENSIONES DEL COLOR */}
      <View style={styles.munsellBox}>
        <Text style={[typography.caption, styles.sectionCaption]}>
          DIMENSIONES DEL COLOR Y TEMPERATURA
        </Text>

        {/* Barra 1: Temperatura */}
        <View style={styles.munsellRow}>
          <View style={styles.munsellLabelRow}>
            <Text style={[typography.bodySmall, styles.munsellName]}>
              Temperatura
            </Text>
            <Text style={[typography.bodySmall, styles.munsellValue]}>
              {munsell.temperatureScore < 0 ? `${Math.abs(munsell.temperatureScore)}% Frío dominante` : `${munsell.temperatureScore}% Cálido`}
            </Text>
          </View>
          <ProgressBar progress={Math.abs(munsell.temperatureScore)} gradientColors={colors.gradients.cyberGlow} />
        </View>

        {/* Barra 2: Profundidad / Valor */}
        <View style={styles.munsellRow}>
          <View style={styles.munsellLabelRow}>
            <Text style={[typography.bodySmall, styles.munsellName]}>
              Profundidad y luminosidad
            </Text>
            <Text style={[typography.bodySmall, styles.munsellValue]}>
              {munsell.valueScore <= 50 ? `${100 - munsell.valueScore}% Profundo` : `${munsell.valueScore}% Claro`}
            </Text>
          </View>
          <ProgressBar progress={100 - munsell.valueScore} gradientColors={colors.gradients.auraGlow} />
        </View>

        {/* Barra 3: Croma / Claridad */}
        <View style={styles.munsellRow}>
          <View style={styles.munsellLabelRow}>
            <Text style={[typography.bodySmall, styles.munsellName]}>
              Intensidad del tono (Croma)
            </Text>
            <Text style={[typography.bodySmall, styles.munsellValue]}>
              {munsell.chromaScore >= 50 ? `${munsell.chromaScore}% Brillante` : `${100 - munsell.chromaScore}% Suave`}
            </Text>
          </View>
          <ProgressBar progress={munsell.chromaScore} gradientColors={colors.gradients.goldGlow} />
        </View>
      </View>

      {/* 2. SECCIÓN: CONTRASTE NATURAL */}
      <View style={styles.contrastCard}>
        <View style={styles.contrastHeader}>
          <View style={styles.contrastTitleRow}>
            <Sliders color={colors.brand.accent} size={16} />
            <Text style={[typography.caption, styles.contrastCaption]}>
              NIVEL DE CONTRASTE NATURAL
            </Text>
          </View>
          <Badge label={contrastMetric.level} variant="accent" />
        </View>
        <Text style={[typography.bodySmall, styles.contrastRule]}>
          <Text style={styles.ruleHighlight}>Recomendación de combinación:</Text> {contrastMetric.stylingRule}
        </Text>
      </View>

      {/* 3. SECCIÓN: COLORES A EVITAR */}
      <View style={styles.toxicSection}>
        <View style={styles.toxicHeader}>
          <AlertOctagon color={colors.status.error} size={18} />
          <Text style={[typography.caption, styles.toxicTitle]}>
            TONOS QUE RESTAN LUMINOSIDAD A TU PIEL
          </Text>
        </View>

        <View style={styles.toxicList}>
          {toxicColors.map((toxic, i) => (
            <View key={i} style={styles.toxicItem}>
              <View style={[styles.toxicDot, { backgroundColor: toxic.hex }]} />
              <View style={styles.toxicInfo}>
                <Text style={[typography.bodySmall, styles.toxicName]}>
                  {toxic.name}
                </Text>
                <Text style={[typography.bodySmall, styles.toxicEffect]}>
                  {toxic.negativeEffect}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 4. SECCIÓN: LA TRIADA DE PALETAS DE ACCIÓN */}
      <View style={styles.actionPalettesSection}>
        <Text style={[typography.caption, styles.sectionCaption]}>
          TU TRIADA DE PALETAS OPERATIVAS
        </Text>

        {/* Pestañas de la Tríada */}
        <View style={styles.triadTabs}>
          <TouchableOpacity
            onPress={() => handleSelectTab('base')}
            style={[styles.triadTab, activeTab === 'base' && styles.triadTabActive]}
          >
            <Briefcase color={activeTab === 'base' ? colors.text.primary : colors.text.muted} size={14} />
            <Text style={[typography.caption, activeTab === 'base' ? styles.triadTabTextActive : styles.triadTabText]}>
              Prendas Base
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectTab('power')}
            style={[styles.triadTab, activeTab === 'power' && styles.triadTabActive]}
          >
            <Crown color={activeTab === 'power' ? colors.text.primary : colors.text.muted} size={14} />
            <Text style={[typography.caption, activeTab === 'power' ? styles.triadTabTextActive : styles.triadTabText]}>
              Colores de Poder
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSelectTab('beauty')}
            style={[styles.triadTab, activeTab === 'beauty' && styles.triadTabActive]}
          >
            <Gem color={activeTab === 'beauty' ? colors.text.primary : colors.text.muted} size={14} />
            <Text style={[typography.caption, activeTab === 'beauty' ? styles.triadTabTextActive : styles.triadTabText]}>
              Maquillaje & Joyas
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contenido según Pestaña */}
        {activeTab === 'base' && (
          <View style={styles.swatchesList}>
            {actionPalettes.baseWardrobe.map((item, idx) => (
              <View key={idx} style={styles.swatchCard}>
                <View style={[styles.swatchSquare, { backgroundColor: item.hex }]} />
                <View style={styles.swatchDetails}>
                  <Text style={[typography.bodyMedium, styles.swatchTitle]}>{item.name}</Text>
                  <Text style={[typography.bodySmall, styles.swatchTip]}>{item.usageTip}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'power' && (
          <View style={styles.swatchesList}>
            {actionPalettes.powerColors.map((item, idx) => (
              <View key={idx} style={styles.swatchCard}>
                <View style={[styles.swatchSquare, { backgroundColor: item.hex }]} />
                <View style={styles.swatchDetails}>
                  <Text style={[typography.bodyMedium, styles.swatchTitle]}>{item.name}</Text>
                  <Text style={[typography.bodySmall, styles.swatchTip]}>{item.usageTip}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'beauty' && (
          <View style={styles.beautyBox}>
            <Text style={[typography.caption, styles.beautySubHeader]}>TONOS DE LABIAL</Text>
            {actionPalettes.beautyAndMetals.lipsticks.map((lip, i) => (
              <Text key={i} style={[typography.bodyMedium, styles.beautyItem]}>• {lip}</Text>
            ))}

            <Text style={[typography.caption, styles.beautySubHeader, { marginTop: 12 }]}>METALES Y JOYERÍA</Text>
            <View style={styles.metalsPillsRow}>
              {actionPalettes.beautyAndMetals.metals.map((metal, i) => (
                <Badge key={i} label={metal} variant="accent" style={{ marginRight: 6 }} />
              ))}
            </View>

            <Text style={[typography.caption, styles.beautySubHeader, { marginTop: 12 }]}>MONTURAS DE GAFAS</Text>
            {actionPalettes.beautyAndMetals.glassesFrameColors.map((frame, i) => (
              <Text key={i} style={[typography.bodyMedium, styles.beautyItem]}>• {frame}</Text>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 150,
  },
  title: {
    color: colors.text.primary,
  },
  subtitle: {
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  sectionCaption: {
    color: colors.text.muted,
    marginBottom: spacing.sm,
    letterSpacing: 0.8,
  },
  munsellBox: {
    backgroundColor: colors.background.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  munsellRow: {
    marginBottom: spacing.sm,
  },
  munsellLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  munsellName: {
    color: colors.text.secondary,
  },
  munsellValue: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  contrastCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: spacing.md,
  },
  contrastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  contrastTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 150,
  },
  contrastCaption: {
    color: colors.brand.accent,
    letterSpacing: 0.8,
  },
  contrastRule: {
    color: colors.text.secondary,
    lineHeight: 18,
  },
  ruleHighlight: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  toxicSection: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginBottom: spacing.md,
  },
  toxicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  toxicTitle: {
    color: colors.status.error,
    letterSpacing: 0.8,
  },
  toxicList: {
    gap: spacing.sm,
  },
  toxicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toxicDot: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  toxicInfo: {
    flex: 1,
  },
  toxicName: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  toxicEffect: {
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 15,
  },
  actionPalettesSection: {
    marginTop: spacing.xs,
  },
  triadTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.surface,
    borderRadius: radius.md,
    padding: 3,
    gap: 4,
    marginBottom: spacing.md,
  },
  triadTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.md - 2,
  },
  triadTabActive: {
    backgroundColor: colors.brand.primary,
  },
  triadTabText: {
    color: colors.text.muted,
  },
  triadTabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  swatchesList: {
    gap: spacing.sm,
  },
  swatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing.md,
  },
  swatchSquare: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  swatchDetails: {
    flex: 1,
  },
  swatchTitle: {
    color: colors.text.primary,
  },
  swatchTip: {
    color: colors.text.muted,
  },
  beautyBox: {
    backgroundColor: colors.background.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  beautySubHeader: {
    color: colors.brand.primaryLight,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  beautyItem: {
    color: colors.text.secondary,
    lineHeight: 22,
  },
  metalsPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
});
