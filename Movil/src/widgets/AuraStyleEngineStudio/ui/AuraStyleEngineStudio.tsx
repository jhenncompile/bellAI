import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Badge, ProgressBar, Button } from '@/shared/ui';
import { AuraSilhouetteProfile } from '@/entities/silhouette/model/types';
import { AestheticVector } from '@/entities/aesthetic/model/types';
import { RuleEvaluation } from '@/entities/style-rules/model/types';
import { AuraAuditData, VisualError } from '@/entities/aura-score/model/types';
import { colors, typography, radius, spacing } from '@/shared/theme';
import { hapticFeedback } from '@/shared/lib/haptics';
import {
  Compass,
  Layers,
  TrendingUp,
  Sliders,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Camera,
} from 'lucide-react-native';

interface AuraStyleEngineStudioProps {
  silhouette?: AuraSilhouetteProfile;
  aesthetic?: AestheticVector;
  audit?: AuraAuditData;
  visualErrors?: VisualError[];
  ruleEvaluations?: RuleEvaluation[];
  onTakeBodyPhoto?: () => void;
}

export const AuraStyleEngineStudio: React.FC<AuraStyleEngineStudioProps> = ({
  silhouette,
  onTakeBodyPhoto,
  aesthetic = {
    minimalista: 22,
    clasico: 26,
    oldMoney: 34,
    romantico: 8,
    streetwear: 6,
    dramatico: 4,
    dominantArchetype: 'Old Money',
    secondaryArchetype: 'Clásico',
    confidenceScore: 94,
    sourcesBreakdown: {
      onboardingWeight: 40,
      morphologyWeight: 30,
      wardrobeWeight: 30,
    },
    description:
      'Tu vector de estilo prioriza sastrería de alta gama (Old Money 34%), cortes clásicos y sobriedad minimalista.',
  },
  audit = {
    baseScore: 100,
    totalPenalties: 13,
    totalBonuses: 5,
    projectedScore: 98,
    projectedTierLabel: 'Nivel Óptimo',
  },
  visualErrors = [
    {
      id: 'err-1',
      title: 'Contraste monótono en prendas superiores',
      penaltyPoints: -6,
      potentialGain: 6,
      fixRecommendation: 'Cambiar a camisa blanca nítida o blazer zafiro (+6 pts)',
      category: 'contraste',
    },
    {
      id: 'err-2',
      title: 'Incompatibilidad de temperatura en joyería',
      penaltyPoints: -4,
      potentialGain: 4,
      fixRecommendation: 'Sustituir accesorios dorados por plata 925 (+4 pts)',
      category: 'color',
    },
    {
      id: 'err-3',
      title: 'Corte de escote compite con mandíbula',
      penaltyPoints: -3,
      potentialGain: 3,
      fixRecommendation: 'Usar escote en V o solapas en punta para elongar el tercio inferior (+3 pts)',
      category: 'corte',
    },
  ],
  ruleEvaluations = [
    {
      ruleId: 'r1',
      ruleName: 'Elongación de Verticalidad',
      passed: true,
      scoreDelta: +7,
      reason: 'El tiro alto eleva el centro de gravedad visual, elongando la figura.',
      pillar: 'silueta',
      potentialPointsGain: 0,
    },
    {
      ruleId: 'r2',
      ruleName: 'Armonía Térmica Perfecta',
      passed: true,
      scoreDelta: +10,
      reason: 'Color en plena consonancia con tu subtono biológico.',
      pillar: 'color',
      potentialPointsGain: 0,
    },
    {
      ruleId: 'r3',
      ruleName: 'Sobrecarga Horizontal Torácica',
      passed: false,
      scoreDelta: -6,
      reason: 'El escote barco añade amplitud horizontal a una línea de hombros ya definida.',
      pillar: 'silueta',
      remedy: 'Cambiar a escote en V o asimétrico (+6 pts)',
      potentialPointsGain: 6,
    },
  ],
}) => {
  const [activeTab, setActiveTab] = useState<'silhouette' | 'aesthetic' | 'rules' | 'audit'>('silhouette');
  const [simulatedGlowUp, setSimulatedGlowUp] = useState(false);

  const handleToggleSimulate = () => {
    hapticFeedback.success();
    setSimulatedGlowUp(!simulatedGlowUp);
  };

  const currentScore = simulatedGlowUp ? audit.projectedScore : 100 - audit.totalPenalties + audit.totalBonuses;

  return (
    <View style={styles.container}>
      {/* Encabezado del Estudio de Silueta */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Compass color={colors.brand.primaryLight} size={18} />
          <Text style={[typography.caption, styles.badgeCaption]}>
            ASESORÍA DE SILUETA & ESTILO
          </Text>
        </View>
        <Text style={[typography.h2, styles.mainTitle]}>
          Tu Guía de Silueta y Estilo
        </Text>
        <Text style={[typography.bodySmall, styles.subtitle]}>
          Recomendaciones personalizadas basadas en tus proporciones para realzar tu figura,
          equilibrar volúmenes y elegir las prendas más favorecedoras.
        </Text>
      </View>

      {/* Selector de Pestañas */}
      <View style={styles.tabsWrapper}>
        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            setActiveTab('silhouette');
          }}
          style={[styles.tabButton, activeTab === 'silhouette' && styles.tabButtonActive]}
        >
          <Compass size={14} color={activeTab === 'silhouette' ? colors.brand.primary : colors.text.muted} />
          <Text style={[typography.caption, activeTab === 'silhouette' ? styles.tabTextActive : styles.tabText]}>
            Silueta
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            setActiveTab('aesthetic');
          }}
          style={[styles.tabButton, activeTab === 'aesthetic' && styles.tabButtonActive]}
        >
          <Layers size={14} color={activeTab === 'aesthetic' ? colors.brand.primary : colors.text.muted} />
          <Text style={[typography.caption, activeTab === 'aesthetic' ? styles.tabTextActive : styles.tabText]}>
            Estética
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            setActiveTab('rules');
          }}
          style={[styles.tabButton, activeTab === 'rules' && styles.tabButtonActive]}
        >
          <Sliders size={14} color={activeTab === 'rules' ? colors.brand.primary : colors.text.muted} />
          <Text style={[typography.caption, activeTab === 'rules' ? styles.tabTextActive : styles.tabText]}>
            Reglas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            setActiveTab('audit');
          }}
          style={[styles.tabButton, activeTab === 'audit' && styles.tabButtonActive]}
        >
          <TrendingUp size={14} color={activeTab === 'audit' ? colors.brand.primary : colors.text.muted} />
          <Text style={[typography.caption, activeTab === 'audit' ? styles.tabTextActive : styles.tabText]}>
            Proyección
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENIDO PESTAÑA 7: SILUETA PERSONAL */}
      {activeTab === 'silhouette' && (
        silhouette ? (
          <Card variant="glass" style={styles.contentCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[typography.h3, styles.cardTitle]}>Proporciones de tu Figura</Text>
                <Text style={[typography.caption, styles.cardSubtitle]}>
                  Medidas de silueta para equilibrar tus looks
                </Text>
              </View>
              <Badge label="Personalizado" variant="primary" />
            </View>

            {/* 4 Dimensiones de Estilo */}
            <View style={styles.dimensionsWrap}>
              {/* Dimensión 1: Verticalidad */}
              <View style={styles.dimItem}>
                <View style={styles.dimHeader}>
                  <Text style={[typography.bodyMedium, styles.dimName]}>Largo de Piernas y Torso</Text>
                  <Text style={[typography.caption, styles.dimValue]}>
                    {silhouette.verticality}% • {Math.round(silhouette.legRatio * 100)}% proporción piernas
                  </Text>
                </View>
                <ProgressBar progress={silhouette.verticality} />
              </View>

              {/* Dimensión 2: Curvatura */}
              <View style={styles.dimItem}>
                <View style={styles.dimHeader}>
                  <Text style={[typography.bodyMedium, styles.dimName]}>Definición de Cintura</Text>
                  <Text style={[typography.caption, styles.dimValue]}>
                    {silhouette.curvature}% • Relación cintura-cadera {silhouette.whr.toFixed(2)}
                  </Text>
                </View>
                <ProgressBar progress={silhouette.curvature} />
              </View>

              {/* Dimensión 3: Angularidad */}
              <View style={styles.dimItem}>
                <View style={styles.dimHeader}>
                  <Text style={[typography.bodyMedium, styles.dimName]}>Estructura de Hombros</Text>
                  <Text style={[typography.caption, styles.dimValue]}>
                    {silhouette.angularity}% • Inclinación {silhouette.shoulderAngle}°
                  </Text>
                </View>
                <ProgressBar progress={silhouette.angularity} />
              </View>

              {/* Dimensión 4: Balance Torácico-Pélvico */}
              <View style={styles.dimItem}>
                <View style={styles.dimHeader}>
                  <Text style={[typography.bodyMedium, styles.dimName]}>Equilibrio Hombros / Cadera</Text>
                  <Text style={[typography.caption, styles.dimValue]}>
                    {silhouette.balance}% de simetría visual
                  </Text>
                </View>
                <ProgressBar progress={silhouette.balance} />
              </View>
            </View>

            {/* Insights Arquitectónicos */}
            <View style={styles.insightsBox}>
              <Text style={[typography.caption, styles.insightsTitle]}>
                CLAVES PARA TUS OUTFITS
              </Text>
              {silhouette.insights.map((insight, idx) => (
                <View key={idx} style={styles.insightRow}>
                  <CheckCircle2 size={13} color={colors.status.success} style={styles.insightIcon} />
                  <Text style={[typography.bodySmall, styles.insightText]}>{insight}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <Card variant="glass" style={styles.contentCard}>
            <View style={styles.emptySilhouetteContainer}>
              <View style={styles.emptyIconCircle}>
                <Camera size={34} color={colors.brand.primaryLight} />
              </View>
              <Text style={[typography.h3, styles.emptyTitle]}>
                Analiza tu Silueta Completa
              </Text>
              <Text style={[typography.bodySmall, styles.emptyDesc]}>
                Para recomendarte los largos de falda, cortes de pantalón y escotes más favorecedores, necesitamos una foto de cuerpo entero.
              </Text>

              <View style={styles.tipsBox}>
                <Text style={[typography.caption, styles.tipsTitle]}>
                  RECOMENDACIONES PARA LA FOTOGRAFÍA:
                </Text>
                <Text style={[typography.caption, styles.tipItem]}>
                  1. Usa prendas que permitan apreciar tu figura con claridad.
                </Text>
                <Text style={[typography.caption, styles.tipItem]}>
                  2. Apoya el celular a la altura de la cintura o pecho.
                </Text>
                <Text style={[typography.caption, styles.tipItem]}>
                  3. Da 2 o 3 pasos hacia atrás hasta salir de pies a cabeza.
                </Text>
              </View>

              {onTakeBodyPhoto && (
                <Button
                  title="Tomar Foto de Silueta Guiada"
                  icon={<Camera color="#FFFFFF" size={18} />}
                  onPress={onTakeBodyPhoto}
                  variant="primary"
                  style={{ alignSelf: 'center', marginTop: 16 }}
                />
              )}
            </View>
          </Card>
        )
      )}

      {/* CONTENIDO PESTAÑA 8: PERFIL ESTÉTICO PERSONAL */}
      {activeTab === 'aesthetic' && (
        <Card variant="glass" style={styles.contentCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[typography.h3, styles.cardTitle]}>Tu Esencia y Estilo Personal</Text>
              <Text style={[typography.caption, styles.cardSubtitle]}>
                Tus estilos predominantes y cómo combinarlos
              </Text>
            </View>
            <Badge label={`Dominante: ${aesthetic.dominantArchetype}`} variant="secondary" />
          </View>

          <Text style={[typography.bodySmall, styles.aestheticDesc]}>
            {aesthetic.description}
          </Text>

          {/* Desglose de Porcentajes */}
          <View style={styles.aestheticList}>
            <View style={styles.aestheticRow}>
              <Text style={[typography.bodySmall, styles.aName]}>Old Money / Quiet Luxury</Text>
              <Text style={[typography.caption, styles.aVal]}>{aesthetic.oldMoney}%</Text>
            </View>
            <ProgressBar progress={aesthetic.oldMoney} />

            <View style={styles.aestheticRow}>
              <Text style={[typography.bodySmall, styles.aName]}>Clásico Atemporal</Text>
              <Text style={[typography.caption, styles.aVal]}>{aesthetic.clasico}%</Text>
            </View>
            <ProgressBar progress={aesthetic.clasico} />

            <View style={styles.aestheticRow}>
              <Text style={[typography.bodySmall, styles.aName]}>Minimalista Sofisticado</Text>
              <Text style={[typography.caption, styles.aVal]}>{aesthetic.minimalista}%</Text>
            </View>
            <ProgressBar progress={aesthetic.minimalista} />

            <View style={styles.aestheticRow}>
              <Text style={[typography.bodySmall, styles.aName]}>Romántico / Soft</Text>
              <Text style={[typography.caption, styles.aVal]}>{aesthetic.romantico}%</Text>
            </View>
            <ProgressBar progress={aesthetic.romantico} />

            <View style={styles.aestheticRow}>
              <Text style={[typography.bodySmall, styles.aName]}>Streetwear Pulido</Text>
              <Text style={[typography.caption, styles.aVal]}>{aesthetic.streetwear}%</Text>
            </View>
            <ProgressBar progress={aesthetic.streetwear} />

            <View style={styles.aestheticRow}>
              <Text style={[typography.bodySmall, styles.aName]}>Dramático / Vanguardia</Text>
              <Text style={[typography.caption, styles.aVal]}>{aesthetic.dramatico}%</Text>
            </View>
            <ProgressBar progress={aesthetic.dramatico} />
          </View>

          {/* Factores de Estilo */}
          <View style={styles.sourcesBox}>
            <Text style={[typography.caption, styles.sourcesTitle]}>¿CÓMO SE DEFINE TU ESTILO?</Text>
            <View style={styles.sourcesPills}>
              <Badge label="Tus preferencias de estilo" variant="neutral" style={styles.sourceBadge} />
              <Badge label="Tu paleta y silueta" variant="neutral" style={styles.sourceBadge} />
              <Badge label="Prendas de tu armario" variant="neutral" style={styles.sourceBadge} />
            </View>
          </View>
        </Card>
      )}

      {/* CONTENIDO PESTAÑA 9: REGLAS DE ESTILISMO */}
      {activeTab === 'rules' && (
        <Card variant="glass" style={styles.contentCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[typography.h3, styles.cardTitle]}>Reglas de Armonía para tu Look</Text>
              <Text style={[typography.caption, styles.cardSubtitle]}>
                Consejos prácticos para estilizar y equilibrar tus prendas
              </Text>
            </View>
            <Badge label="Consejos Activos" variant="primary" />
          </View>

          <View style={styles.rulesList}>
            {ruleEvaluations.map((rule, idx) => (
              <View
                key={idx}
                style={[
                  styles.ruleCard,
                  rule.passed ? styles.ruleCardPassed : styles.ruleCardFailed,
                ]}
              >
                <View style={styles.ruleCardHeader}>
                  <View style={styles.ruleTitleWrap}>
                    {rule.passed ? (
                      <CheckCircle2 size={16} color={colors.status.success} />
                    ) : (
                      <AlertTriangle size={16} color={colors.status.error} />
                    )}
                    <Text style={[typography.bodyMedium, styles.ruleName]}>{rule.ruleName}</Text>
                  </View>
                  <Badge
                    label={`${rule.scoreDelta > 0 ? '+' : ''}${rule.scoreDelta} pts`}
                    variant={rule.passed ? 'primary' : 'neutral'}
                  />
                </View>

                <Text style={[typography.bodySmall, styles.ruleReason]}>{rule.reason}</Text>

                {rule.remedy && (
                  <View style={styles.remedyRow}>
                    <CheckCircle2 size={12} color={colors.brand.primaryLight} />
                    <Text style={[typography.caption, styles.remedyText]}>
                      Corrección: {rule.remedy}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* CONTENIDO PESTAÑA AUDIT: PROYECCIÓN Y MEJORAS */}
      {activeTab === 'audit' && (
        <Card variant="gradientBorder" style={styles.contentCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[typography.h3, styles.cardTitle]}>Plan de Armonía y Proyección</Text>
              <Text style={[typography.caption, styles.cardSubtitle]}>
                Evaluación de armonía y balance visual
              </Text>
            </View>
            <Badge
              label={simulatedGlowUp ? audit.projectedTierLabel : 'Armonía Elevada'}
              variant={simulatedGlowUp ? 'primary' : 'secondary'}
            />
          </View>

          {/* Gran Comparador de Puntuación */}
          <View style={styles.scoreCompareBox}>
            <View style={styles.scoreCol}>
              <Text style={[typography.caption, styles.scoreLabel]}>PUNTAJE ACTUAL</Text>
              <Text style={[typography.h1, styles.currentScoreText]}>{currentScore}</Text>
              <Text style={[typography.caption, styles.scoreScale]}>de 100 puntos</Text>
            </View>

            <View style={styles.arrowCol}>
              <ChevronRight size={24} color={colors.brand.primaryLight} />
            </View>

            <View style={styles.scoreCol}>
              <Text style={[typography.caption, styles.scoreLabel]}>POTENCIAL ESTIMADO</Text>
              <Text style={[typography.h1, styles.projectedScoreText]}>
                {audit.projectedScore}
              </Text>
              <Text style={[typography.caption, styles.scoreScale]}>+6 pts alcanzables</Text>
            </View>
          </View>

          {/* Botón Interactivo de Simulación */}
          <Button
            title={simulatedGlowUp ? 'Ver estilo inicial' : 'Simular mejoras de estilo'}
            onPress={handleToggleSimulate}
            variant={simulatedGlowUp ? 'secondary' : 'primary'}
            style={styles.simulateBtn}
          />

          {/* Lista de Mejoras Sugeridas */}
          <View style={styles.errorsSection}>
            <Text style={[typography.caption, styles.errorsSectionTitle]}>
              OPORTUNIDADES DE MEJORA EN TU LOOK
            </Text>

            {visualErrors.map((err) => (
              <View key={err.id} style={styles.errorItem}>
                <View style={styles.errorItemHeader}>
                  <Text style={[typography.bodySmall, styles.errorTitle]}>{err.title}</Text>
                  <Text style={[typography.caption, styles.penaltyPoints]}>
                    {simulatedGlowUp ? `+${err.potentialGain} RECUPERADOS` : `${err.penaltyPoints} pts`}
                  </Text>
                </View>
                <Text style={[typography.caption, styles.fixRec]}>
                  Acción: {err.fixRecommendation}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  badgeCaption: {
    color: colors.brand.primaryLight,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  mainTitle: {
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.text.muted,
    lineHeight: 18,
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.full,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  tabText: {
    color: colors.text.muted,
    fontWeight: '500',
    fontSize: 11,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  contentCard: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text.primary,
  },
  cardSubtitle: {
    color: colors.text.muted,
    marginTop: 2,
  },
  dimensionsWrap: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dimItem: {
    gap: 6,
  },
  dimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dimName: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  dimValue: {
    color: colors.brand.primaryLight,
    fontWeight: '500',
  },
  insightsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: spacing.xs,
  },
  insightsTitle: {
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  insightIcon: {
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  aestheticDesc: {
    color: colors.text.secondary,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  aestheticList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  aestheticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  aName: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  aVal: {
    color: colors.brand.primaryLight,
    fontWeight: '700',
  },
  sourcesBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sourcesTitle: {
    color: colors.text.muted,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  sourcesPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sourceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  rulesList: {
    gap: spacing.sm,
  },
  ruleCard: {
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  ruleCardPassed: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  ruleCardFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  ruleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ruleTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  ruleName: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  ruleReason: {
    color: colors.text.secondary,
    lineHeight: 18,
    marginTop: 2,
  },
  remedyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  remedyText: {
    color: colors.brand.primaryLight,
    fontWeight: '600',
  },
  scoreCompareBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scoreCol: {
    alignItems: 'center',
  },
  arrowCol: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  currentScoreText: {
    color: colors.brand.primaryLight,
    fontWeight: '800',
  },
  projectedScoreText: {
    color: colors.status.success,
    fontWeight: '800',
  },
  scoreScale: {
    color: colors.text.muted,
    marginTop: 2,
  },
  simulateBtn: {
    marginBottom: spacing.md,
  },
  errorsSection: {
    gap: spacing.xs,
  },
  errorsSectionTitle: {
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  errorItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  errorItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  errorTitle: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  penaltyPoints: {
    color: colors.status.error,
    fontWeight: '700',
  },
  fixRec: {
    color: colors.brand.primaryLight,
    lineHeight: 16,
    marginTop: 2,
  },
  emptySilhouetteContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyDesc: {
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tipsBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  tipsTitle: {
    color: colors.brand.primaryLight,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tipItem: {
    color: colors.text.muted,
    lineHeight: 18,
  },
});
