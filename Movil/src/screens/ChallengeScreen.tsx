import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { ScreenContainer, Card, Badge, Button, ProgressBar } from '@/shared/ui';
import { AuraHeroHeader } from '@/widgets/AuraHeroHeader/ui/AuraHeroHeader';
import { useScanWorkflow } from '@/features/scan-diagnosis/model/useScanWorkflow';
import { AuraGoalService } from '@/entities/goal/model/auraGoalService';
import { AuraGoal } from '@/entities/goal/model/types';
import { useTheme, typography, radius, spacing } from '@/shared/theme';
import { hapticFeedback } from '@/shared/lib/haptics';
import { router } from 'expo-router';
import {
  Flame,
  Target,
  CheckCircle2,
  Circle,
  Calendar,
  Sparkles,
  Shirt,
  Swords,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';
import { DigitalWardrobe, DigitalWardrobeView } from '@/features/digital-wardrobe/DigitalWardrobe';

export const ChallengeScreen: React.FC = () => {
  const { colors: theme } = useTheme();
  const { currentDiagnostic } = useScanWorkflow();
  const [activeTab, setActiveTab] = useState<'goal' | 'community'>('goal');
  const [closetView, setClosetView] = useState<DigitalWardrobeView>('list');
  const [activeGoal, setActiveGoal] = useState<AuraGoal | null>(null);
  const showChallengeHeader = activeTab === 'goal' || closetView === 'list';

  useEffect(() => {
    loadGoal();
  }, [currentDiagnostic]);

  const loadGoal = async () => {
    const goal = await AuraGoalService.getActiveGoal(currentDiagnostic || undefined);
    setActiveGoal(goal);
  };

  const handleToggleTask = async (taskId: string) => {
    hapticFeedback.medium();
    const updated = await AuraGoalService.toggleTask(taskId, currentDiagnostic || undefined);
    setActiveGoal({ ...updated });
  };

  return (
    <ScreenContainer scrollable>
      <View style={showChallengeHeader ? undefined : { display: 'none' }}>
        <AuraHeroHeader seasonLabel={currentDiagnostic?.season || 'Invierno Fuerte'} />

        {/* Selector de Pestañas: Mi Meta Personal (Pilar 15) vs Armario Digital */}
        <View style={styles.tabToggleRow}>
        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            setActiveTab('goal');
          }}
          style={[
            styles.toggleBtn,
            activeTab === 'goal'
              ? { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary }
              : { backgroundColor: theme.background.surfaceElevated, borderColor: theme.border.subtle },
          ]}
          activeOpacity={0.8}
        >
          <Target color={activeTab === 'goal' ? '#FFFFFF' : theme.text.muted} size={16} />
          <Text
            style={[
              typography.caption,
              { color: activeTab === 'goal' ? '#FFFFFF' : theme.text.secondary, fontWeight: '700' },
            ]}
          >
            Meta de Estilo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            setActiveTab('community');
          }}
          style={[
            styles.toggleBtn,
            activeTab === 'community'
              ? { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary }
              : { backgroundColor: theme.background.surfaceElevated, borderColor: theme.border.subtle },
          ]}
          activeOpacity={0.8}
        >
          <Shirt color={activeTab === 'community' ? '#FFFFFF' : theme.text.muted} size={16} />
          <Text
            style={[
              typography.caption,
              { color: activeTab === 'community' ? '#FFFFFF' : theme.text.secondary, fontWeight: '700' },
            ]}
          >
            Armario Digital
          </Text>
        </TouchableOpacity>
        </View>
      </View>

      {/* CONTENIDO 1: META DE ESTILO */}
      {activeTab === 'goal' && activeGoal && (
        <View style={styles.goalContainer}>
          {/* Tarjeta de Resumen de Meta Activa */}
          <Card variant="gradientBorder" style={styles.goalSummaryCard}>
            <View style={styles.goalHeaderRow}>
              <View style={styles.goalTitleBadge}>
                <Target color={theme.brand.primaryLight} size={16} />
                <Text style={[typography.caption, { color: theme.brand.primaryLight, fontWeight: '700' }]}>
                  META ACTIVA
                </Text>
              </View>
              <Badge label="4 Semanas" variant="primary" />
            </View>

            <Text style={[typography.h2, { color: theme.text.primary, marginTop: 4 }]}>
              {activeGoal.title}
            </Text>

            <Text style={[typography.bodySmall, { color: theme.text.secondary, marginTop: 2 }]}>
              Plan de asesoría de imagen estructurado paso a paso para brillar en tu ocasión especial.
            </Text>

            {/* Barra de Progreso General */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={[typography.caption, { color: theme.text.muted }]}>Progreso General</Text>
                <Text style={[typography.caption, { color: theme.brand.accent, fontWeight: '700' }]}>
                  {activeGoal.progressPercentage}% COMPLETADO
                </Text>
              </View>
              <ProgressBar progress={activeGoal.progressPercentage} />
            </View>
          </Card>

          {/* Hitos Semanales Paso a Paso */}
          <Text style={[typography.caption, styles.roadmapTitle, { color: theme.text.muted }]}>
            PLAN SEMANAL PASO A PASO
          </Text>

          <View style={styles.milestonesList}>
            {activeGoal.milestones.map((milestone) => (
              <Card key={milestone.weekNumber} style={styles.milestoneCard}>
                <View style={styles.milestoneHeader}>
                  <View style={styles.weekNumberPill}>
                    <Text style={[typography.caption, { color: theme.brand.primaryLight, fontWeight: '700' }]}>
                      SEM {milestone.weekNumber}
                    </Text>
                  </View>
                  <Text style={[typography.h3, { color: theme.text.primary, flex: 1, marginLeft: 8 }]}>
                    {milestone.title.split(': ')[1] || milestone.title}
                  </Text>
                  {milestone.completed && (
                    <CheckCircle2 color={theme.status.success} size={18} />
                  )}
                </View>

                <Text style={[typography.bodySmall, { color: theme.text.secondary, marginVertical: 6 }]}>
                  {milestone.objective}
                </Text>

                {/* Tareas de la Semana con Checkbox interactivo */}
                <View style={styles.tasksList}>
                  {milestone.tasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => handleToggleTask(task.id)}
                      style={[
                        styles.taskRow,
                        task.completed && { opacity: 0.65 },
                      ]}
                      activeOpacity={0.7}
                    >
                      {task.completed ? (
                        <CheckCircle2 color={theme.status.success} size={18} />
                      ) : (
                        <Circle color={theme.text.muted} size={18} />
                      )}
                      <View style={styles.taskTexts}>
                        <Text
                          style={[
                            typography.bodyMedium,
                            {
                              color: task.completed ? theme.text.muted : theme.text.primary,
                              textDecorationLine: task.completed ? 'line-through' : 'none',
                              fontWeight: '600',
                            },
                          ]}
                        >
                          {task.title}
                        </Text>
                        <Text style={[typography.caption, { color: theme.text.secondary }]}>
                          {task.description}
                        </Text>
                      </View>
                      {task.actionRoute && (
                        <TouchableOpacity
                          onPress={() => router.push(task.actionRoute as any)}
                          style={styles.actionArrow}
                        >
                          <ChevronRight color={theme.brand.primaryLight} size={16} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* CONTENIDO 2: ARMARIO DIGITAL (HU-009, HU-011, HU-040) */}
      {activeTab === 'community' && <DigitalWardrobe onViewChange={setClosetView} />}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabToggleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 6,
  },
  goalContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  goalSummaryCard: {
    padding: spacing.md,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roadmapTitle: {
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  milestonesList: {
    gap: spacing.md,
  },
  milestoneCard: {
    padding: spacing.md,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekNumberPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  tasksList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  taskTexts: {
    flex: 1,
  },
  actionArrow: {
    padding: 4,
  },
  communityContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
