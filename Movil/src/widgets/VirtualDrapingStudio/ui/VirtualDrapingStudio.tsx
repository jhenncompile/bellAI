import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { Card, Badge } from '@/shared/ui';
import { colors, useTheme, typography, radius, spacing } from '@/shared/theme';
import { hapticFeedback } from '@/shared/lib/haptics';
import { MediaVaultService } from '@/entities/media-vault/model/mediaVaultService';
import {
  Palette,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Shirt,
  Sparkles,
  Wand2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface DrapeOption {
  id: string;
  name: string;
  colorHex: string;
  type: 'frio' | 'calido';
  verdict: 'FAVORECE' | 'DESFAVORECE';
  explanation: string;
}

export function getDrapesForSeason(seasonName: string): Record<string, [DrapeOption, DrapeOption]> {
  const isWarm =
    seasonName.includes('Otono') ||
    seasonName.includes('Otoño') ||
    seasonName.includes('Primavera') ||
    seasonName.includes('Calido') ||
    seasonName.includes('Cálido');

  if (isWarm) {
    return {
      temperatura: [
        {
          id: 'warm-mustard-terra',
          name: 'Terracota / Mostaza Cálido',
          colorHex: '#C2410C',
          type: 'calido',
          verdict: 'FAVORECE',
          explanation:
            'Armoniza con la melanina y caroteno natural de tu piel. Aporta luminosidad saludable, difumina sombras bajo el mentón y define tus facciones.',
        },
        {
          id: 'cool-sapphire-blue',
          name: 'Azul Zafiro Frío',
          colorHex: '#1E3A8A',
          type: 'frio',
          verdict: 'DESFAVORECE',
          explanation:
            'Compite con tu piel cálida. Al proyectar reflejo azulado frío, genera sombras oscuras bajo la mandíbula y resalta ojeras.',
        },
      ],
      metales: [
        {
          id: 'metal-gold',
          name: 'Oro Amarillo / Bronce (Cálido)',
          colorHex: '#D97706',
          type: 'calido',
          verdict: 'FAVORECE',
          explanation:
            'Acompaña la calidez natural de tu rostro y aporta un resplandor dorado limpio a tu mirada.',
        },
        {
          id: 'metal-silver',
          name: 'Plata Pura (Frío)',
          colorHex: '#CBD5E1',
          type: 'frio',
          verdict: 'DESFAVORECE',
          explanation:
            'Crea un corte visual artificial y le resta vivacidad y calidez a tus facciones.',
        },
      ],
      contraste: [
        {
          id: 'contrast-olive-coffee',
          name: 'Verde Oliva & Café Expreso',
          colorHex: '#3F3722',
          type: 'calido',
          verdict: 'FAVORECE',
          explanation:
            'Contraste rico y profundo ideal para cabello oscuro y tez cálida o trigueña.',
        },
        {
          id: 'contrast-gray',
          name: 'Gris Asfalto Frío Monótono',
          colorHex: '#64748B',
          type: 'frio',
          verdict: 'DESFAVORECE',
          explanation:
            'Apaga la vibrancia de tus rasgos y hace que el rostro luzca deslavado.',
        },
      ],
    };
  }

  // Paleta Fría (Invierno Fuerte / Deep Winter)
  return {
    temperatura: [
      {
        id: 'cool-blue',
        name: 'Azul Zafiro (Frío)',
        colorHex: '#1E3A8A',
        type: 'frio',
        verdict: 'FAVORECE',
        explanation:
          'Ilumina el cutis instantáneamente, neutraliza rojeces o sombras y resalta la nitidez de tu mirada.',
      },
      {
        id: 'warm-mustard',
        name: 'Mostaza Cálido (Cálido)',
        colorHex: '#B45309',
        type: 'calido',
        verdict: 'DESFAVORECE',
        explanation:
          'Proyecta un reflejo amarillento artificial sobre la piel y apaga el contraste limpio de tus ojos.',
      },
    ],
    metales: [
      {
        id: 'metal-silver',
        name: 'Plata Pura (Frío)',
        colorHex: '#E2E8F0',
        type: 'frio',
        verdict: 'FAVORECE',
        explanation:
          'Aporta frescura, claridad visual y elegancia nítida con tu base fría.',
      },
      {
        id: 'metal-gold',
        name: 'Oro Amarillo (Cálido)',
        colorHex: '#EAB308',
        type: 'calido',
        verdict: 'DESFAVORECE',
        explanation:
          'Compite con tu pigmentación y resta luminosidad a tu sonrisa.',
      },
    ],
    contraste: [
      {
        id: 'contrast-black',
        name: 'Negro Azabache & Blanco Nítido',
        colorHex: '#000000',
        type: 'frio',
        verdict: 'FAVORECE',
        explanation:
          'Crea el marco perfecto para el contraste nítido de tu cabello y ojos oscuros.',
      },
      {
        id: 'contrast-beige',
        name: 'Beige Apagado / Canela',
        colorHex: '#D6D3D1',
        type: 'calido',
        verdict: 'DESFAVORECE',
        explanation:
          'Apaga tu mirada y hace que tu piel luzca apagada y sin energía.',
      },
    ],
  };
}

export type StudioSimulationMode = 'draping' | 'tryon' | 'makeup';

interface VirtualDrapingStudioProps {
  imageUri?: string;
  season?: string;
  initialMode?: StudioSimulationMode;
}

export const VirtualDrapingStudio: React.FC<VirtualDrapingStudioProps> = ({
  imageUri,
  season = 'Otoño Cálido',
  initialMode = 'draping',
}) => {
  const { colors: theme, isDark } = useTheme();
  const [simulationMode, setSimulationMode] = useState<StudioSimulationMode>(initialMode);
  const [activeSeason, setActiveSeason] = useState(
    season.includes('Invierno') ? 'Invierno Fuerte' : 'Otoño Cálido (Deep Autumn)'
  );
  const [testType, setTestType] = useState<'temperatura' | 'metales' | 'contraste'>('temperatura');
  const [selectedDrapeIndex, setSelectedDrapeIndex] = useState<0 | 1>(0);
  const [activeImageUri, setActiveImageUri] = useState<string | undefined>(imageUri);

  const router = useRouter();

  useEffect(() => {
    if (imageUri) {
      setActiveImageUri(imageUri);
    } else {
      MediaVaultService.getItemsByFolder('rostro').then((items) => {
        if (items.length > 0 && items[0].localUri) {
          setActiveImageUri(items[0].localUri);
        }
      });
    }

  }, [imageUri]);

  useEffect(() => {
    if (season) {
      const isWarm =
        season.includes('Otono') ||
        season.includes('Otoño') ||
        season.includes('Primavera') ||
        season.includes('Calido') ||
        season.includes('Cálido');
      setActiveSeason(isWarm ? 'Otoño Cálido (Deep Autumn)' : 'Invierno Fuerte');
    }
  }, [season]);

  const drapesMap = getDrapesForSeason(activeSeason);
  const currentDrapes = drapesMap[testType];
  const activeDrape = currentDrapes[selectedDrapeIndex];

  const handleSelectDrape = (index: 0 | 1) => {
    hapticFeedback.medium();
    setSelectedDrapeIndex(index);
  };

  const handleSelectTestType = (type: 'temperatura' | 'metales' | 'contraste') => {
    hapticFeedback.light();
    setTestType(type);
    setSelectedDrapeIndex(0);
  };


  return (
    <Card variant="gradientBorder" style={styles.card}>
      {/* Selector de Modo Principal de Simulación */}
      <View style={styles.modeTabsRow}>
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Modo Drapeado de Telas y Colorimetría"
          accessibilityState={{ selected: simulationMode === 'draping' }}
          onPress={() => {
            hapticFeedback.light();
            setSimulationMode('draping');
          }}
          style={[styles.modeTab, simulationMode === 'draping' && styles.modeTabActive]}
        >
          <Palette size={16} color={simulationMode === 'draping' ? '#FFFFFF' : theme.text.secondary} />
          <Text style={[styles.modeTabText, simulationMode === 'draping' && styles.modeTabTextActive]}>
            Drapeado
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Modo probador virtual"
          accessibilityState={{ selected: simulationMode === 'tryon' }}
          onPress={() => {
            hapticFeedback.light();
            setSimulationMode('tryon');
          }}
          style={[styles.modeTab, simulationMode === 'tryon' && styles.modeTabActive]}
        >
          <Shirt size={16} color={simulationMode === 'tryon' ? '#FFFFFF' : theme.text.secondary} />
          <Text style={[styles.modeTabText, simulationMode === 'tryon' && styles.modeTabTextActive]}>
            Probador
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityLabel="Modo maquillaje virtual"
          accessibilityState={{ selected: simulationMode === 'makeup' }}
          onPress={() => {
            hapticFeedback.light();
            setSimulationMode('makeup');
          }}
          style={[styles.modeTab, simulationMode === 'makeup' && styles.modeTabActive]}
        >
          <Sparkles size={16} color={simulationMode === 'makeup' ? '#FFFFFF' : theme.text.secondary} />
          <Text style={[styles.modeTabText, simulationMode === 'makeup' && styles.modeTabTextActive]}>
            Maquillaje
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODO 1: DRAPEADO VIRTUAL DE TELAS */}
      {simulationMode === 'draping' && (
        <>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Palette color={theme.brand.secondary} size={18} />
              <Text style={[typography.h3, { color: theme.text.primary, fontSize: 16 }]} numberOfLines={1}>
                Drapeado Virtual
              </Text>
            </View>
            <Badge label="Según tu estación" variant="secondary" style={styles.badge} />
          </View>

          <Text style={[typography.bodySmall, { color: theme.text.secondary, marginBottom: spacing.xs }]}>
            Observa cómo reacciona tu piel ante telas frías frente a tonos cálidos.
          </Text>

          {/* Calibración de Subtono */}
          <View style={[styles.calibrationBox, { backgroundColor: isDark ? 'rgba(168,85,247,0.08)' : 'rgba(168,85,247,0.05)', borderColor: theme.border.subtle }]}>
            <View style={styles.calibrationHeader}>
              <Palette color={colors.brand.secondary} size={13} />
              <Text style={[typography.caption, { color: colors.brand.secondary, fontWeight: '700' }]}>
                CALIBRACIÓN DE SUBTONO
              </Text>
            </View>
            <View style={styles.calibrationOptionsRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Seleccionar subtono cálido con dorados y tierra"
                onPress={() => {
                  hapticFeedback.light();
                  setActiveSeason('Otoño Cálido (Deep Autumn)');
                  setSelectedDrapeIndex(0);
                }}
                style={[
                  styles.calibrationBtn,
                  activeSeason.includes('Otoño') && styles.calibrationBtnActive,
                  { borderColor: theme.border.subtle },
                ]}
              >
                <Text style={[typography.caption, activeSeason.includes('Otoño') ? styles.calibTextActive : { color: theme.text.secondary }]}>
                  Subtono cálido (dorados y tierra)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Seleccionar subtono frío con plata y azulados"
                onPress={() => {
                  hapticFeedback.light();
                  setActiveSeason('Invierno Fuerte');
                  setSelectedDrapeIndex(0);
                }}
                style={[
                  styles.calibrationBtn,
                  activeSeason.includes('Invierno') && styles.calibrationBtnActive,
                  { borderColor: theme.border.subtle },
                ]}
              >
                <Text style={[typography.caption, activeSeason.includes('Invierno') ? styles.calibTextActive : { color: theme.text.secondary }]}>
                  Subtono frío (plata y azulados)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Selector de Tipo de Test */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.testTypesRow}>
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityLabel="Prueba Frío contra Cálido"
              accessibilityState={{ selected: testType === 'temperatura' }}
              onPress={() => handleSelectTestType('temperatura')}
              style={[styles.testTab, testType === 'temperatura' && styles.testTabActive]}
            >
              <Text style={[typography.caption, testType === 'temperatura' ? styles.testTabTextActive : styles.testTabText]}>
                Frío vs Cálido
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityLabel="Prueba Metales Plata contra Oro"
              accessibilityState={{ selected: testType === 'metales' }}
              onPress={() => handleSelectTestType('metales')}
              style={[styles.testTab, testType === 'metales' && styles.testTabActive]}
            >
              <Text style={[typography.caption, testType === 'metales' ? styles.testTabTextActive : styles.testTabText]}>
                Plata vs Oro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityLabel="Prueba Contraste Alto contra Bajo"
              accessibilityState={{ selected: testType === 'contraste' }}
              onPress={() => handleSelectTestType('contraste')}
              style={[styles.testTab, testType === 'contraste' && styles.testTabActive]}
            >
              <Text style={[typography.caption, testType === 'contraste' ? styles.testTabTextActive : styles.testTabText]}>
                Alto vs Bajo
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Lienzo con Foto y Tela Virtual */}
          <View style={styles.studioCanvas}>
            <View style={styles.photoContainer}>
              {activeImageUri ? (
                <Image source={{ uri: activeImageUri }} style={styles.facePhoto} />
              ) : (
                <View style={styles.placeholderFace}>
                  <Camera color={colors.brand.primaryLight} size={36} />
                  <Text style={[typography.bodySmall, styles.placeholderTitle]}>
                    Sin foto de rostro cargada
                  </Text>
                  <Text style={[typography.caption, styles.placeholderDesc]}>
                    Toma una foto de tu rostro para comparar colores directamente con tu piel.
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.drapeCloth, { backgroundColor: activeDrape.colorHex }]}>
              <Text style={[typography.caption, styles.drapeNameOnCloth]}>
                TELA: {activeDrape.name.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Selector Comparativo A vs B */}
          <View style={styles.compareButtonsRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar tela ${currentDrapes[0].name}`}
              accessibilityState={{ selected: selectedDrapeIndex === 0 }}
              onPress={() => handleSelectDrape(0)}
              style={[styles.compareBtn, selectedDrapeIndex === 0 && styles.compareBtnActive]}
            >
              <View style={[styles.swatchDot, { backgroundColor: currentDrapes[0].colorHex }]} />
              <Text style={[typography.bodySmall, selectedDrapeIndex === 0 ? styles.compareTextActive : styles.compareText]} numberOfLines={1}>
                {currentDrapes[0].name}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar tela ${currentDrapes[1].name}`}
              accessibilityState={{ selected: selectedDrapeIndex === 1 }}
              onPress={() => handleSelectDrape(1)}
              style={[styles.compareBtn, selectedDrapeIndex === 1 && styles.compareBtnActive]}
            >
              <View style={[styles.swatchDot, { backgroundColor: currentDrapes[1].colorHex }]} />
              <Text style={[typography.bodySmall, selectedDrapeIndex === 1 ? styles.compareTextActive : styles.compareText]} numberOfLines={1}>
                {currentDrapes[1].name}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Veredicto Biométrico */}
          <View style={[styles.verdictCard, activeDrape.verdict === 'FAVORECE' ? styles.verdictGood : styles.verdictBad]}>
            <View style={styles.verdictHeader}>
              {activeDrape.verdict === 'FAVORECE' ? (
                <CheckCircle2 color={colors.state.success} size={18} />
              ) : (
                <AlertTriangle color={colors.state.warning} size={18} />
              )}
              <Text style={[typography.caption, activeDrape.verdict === 'FAVORECE' ? styles.verdictGoodText : styles.verdictBadText]}>
                {activeDrape.verdict === 'FAVORECE' ? 'ARMONIZA CON TU PIEL' : 'RESTA LUMINOSIDAD'}
              </Text>
            </View>
            <Text style={[typography.bodyMedium, styles.verdictExplanation]}>
              {activeDrape.explanation}
            </Text>
          </View>
        </>
      )}

      {/* MODO 2 y 3: se procesan de verdad en el servidor (simulador de BellAI) */}
      {(simulationMode === 'tryon' || simulationMode === 'makeup') && (
        <>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {simulationMode === 'tryon' ? (
                <Shirt color={theme.palette.terracotta} size={18} />
              ) : (
                <Sparkles color={colors.brand.secondary} size={18} />
              )}
              <Text style={[typography.h3, { color: theme.text.primary, fontSize: 16 }]} numberOfLines={1}>
                {simulationMode === 'tryon' ? 'Probador virtual' : 'Maquillaje virtual'}
              </Text>
            </View>
          </View>

          <Text style={[typography.bodySmall, { color: theme.text.secondary, marginBottom: spacing.sm }]}>
            {simulationMode === 'tryon'
              ? 'Elige una prenda de tu armario y la colocamos sobre tu foto siguiendo la posición de tus hombros y caderas. Es una vista aproximada en 2D.'
              : 'Aplicamos labial, rubor o sombras sobre tu foto siguiendo los puntos de tu rostro. El resultado es una vista aproximada.'}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={simulationMode === 'tryon' ? 'Abrir el probador virtual' : 'Abrir el maquillaje virtual'}
            onPress={() => {
              hapticFeedback.medium();
              router.push({ pathname: '/simulator', params: { kind: simulationMode === 'tryon' ? 'prenda' : 'maquillaje' } } as never);
            }}
            style={[styles.openSimulatorBtn, { backgroundColor: theme.palette.terracotta }]}
          >
            <Wand2 color="#FFFFFF" size={18} />
            <Text style={styles.openSimulatorText}>
              {simulationMode === 'tryon' ? 'Probarme una prenda' : 'Probar maquillaje'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  openSimulatorBtn: {
    minHeight: 48,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  openSimulatorText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    marginHorizontal: 0,
    marginVertical: spacing.sm,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: radius.md,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  modeTabActive: {
    backgroundColor: colors.brand.primary,
  },
  modeTabText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 150,
  },
  badge: {
    flexShrink: 1,
  },
  calibrationBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  calibrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  calibrationOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calibrationBtn: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calibrationBtnActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primaryLight,
  },
  calibTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  testTypesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  testTab: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  testTabActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  testTabText: {
    color: colors.text.muted,
  },
  testTabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  studioCanvas: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0C0E14',
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    alignSelf: 'center',
  },
  photoContainer: {
    height: 250,
    width: '100%',
    position: 'relative',
  },
  facePhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderFace: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
  },
  placeholderTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  placeholderDesc: {
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  drapeCloth: {
    height: 64,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  drapeNameOnCloth: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  compareButtonsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  compareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  compareBtnActive: {
    backgroundColor: colors.brand.accentSoft,
    borderColor: colors.brand.primary,
  },
  swatchDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  compareText: {
    color: colors.text.muted,
  },
  compareTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  verdictCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  verdictGood: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  verdictBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  verdictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  verdictGoodText: {
    color: colors.state.success,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verdictBadText: {
    color: colors.state.danger,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verdictExplanation: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  // Estilos Probador VITON-HD
  garmentSelectorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  garmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  garmentChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primaryLight,
  },
  garmentColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  garmentChipText: {
    color: colors.text.secondary,
  },
  garmentChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tryonOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    opacity: 0.92,
  },
  tryonOverlayText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1,
  },
  tryonOverlaySubtext: {
    ...typography.hint,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  // Estilos Maquillaje BeautyGAN
  makeupStylesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  makeupStyleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  makeupStyleBtnActive: {
    backgroundColor: colors.brand.accentSoft,
    borderColor: colors.brand.primary,
  },
  makeupColorPair: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  makeupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  makeupStyleText: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  makeupStyleTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  makeupOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  makeupBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
  },
});
