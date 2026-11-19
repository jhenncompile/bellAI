import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Circle, CircleCheck, Flame } from 'lucide-react-native';
import { Banner, Chip, ContentState, PageHeader, useNotice } from '@/shared/ui';
import { Appear, CoralCard, CoralLink, CoralScreen, coralText, useCoral } from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { hapticFeedback } from '@/shared/lib/haptics';
import { bellaiService, type ChallengeAction, type RemoteChallenge } from '@/features/bellai/api/bellaiService';
import { ScoreBar, SectionTitle } from '@/features/bellai/ui/components';

/** Pantalla de la app donde se hace cada tarea. */
const ACTION_ROUTES: Record<ChallengeAction, string> = {
  studio: '/studio',
  wardrobe: '/wardrobe',
  outfits: '/outfits',
  style: '/style',
  simulator: '/simulator',
  advisor: '/advisor',
  compatibility: '/compatibility',
  profile: '/profile',
};

/** «16 nov» a partir de una fecha AAAA-MM-DD (sin pasar por UTC, para no cambiar de día). */
function shortDay(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function daysLeftText(days?: number): string {
  if (days === undefined) return '';
  if (days <= 0) return 'Último día';
  return days === 1 ? 'Queda 1 día' : `Quedan ${days} días`;
}

/** HU-28: reto semanal de estilo con tareas, avance y semanas anteriores. Se guarda en la cuenta. */
export const WeeklyChallengeScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const { notify } = useNotice();
  const [challenge, setChallenge] = useState<RemoteChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchChallenge = useCallback(() => bellaiService.getActiveChallenge()
    .then((r) => { setChallenge(r); setError(null); })
    .catch((err) => setError(friendlyMessage(err, 'Revisa tu conexión e inténtalo de nuevo.')))
    .finally(() => setLoading(false)), []);

  // Al volver de hacer una tarea en otra pantalla se ve el avance al día
  useFocusEffect(useCallback(() => {
    void fetchChallenge();
  }, [fetchChallenge]));

  const retry = () => {
    setLoading(true);
    setError(null);
    void fetchChallenge();
  };

  const toggle = async (task: RemoteChallenge['tasks'][number]) => {
    if (saving) return;
    setSaving(task.id);
    void hapticFeedback.light();
    try {
      const updated = await bellaiService.setChallengeTask(task.id, !task.completedAt);
      if (updated) setChallenge(updated);
      if (updated?.progress && updated.progress.total > 0 && updated.progress.completed === updated.progress.total) {
        void hapticFeedback.success();
        notify({ kind: 'success', message: '¡Completaste el reto de esta semana!' });
      }
    } catch (err) {
      notify({ kind: 'error', message: friendlyMessage(err, 'No guardamos la tarea. Inténtalo de nuevo.') });
    } finally {
      setSaving(null);
    }
  };

  const renderBody = () => {
    if (loading && !challenge) {
      return <ContentState loading title="Preparando el reto de la semana" description="Un momento, por favor." />;
    }
    if (error && !challenge) {
      return <Banner kind="error" title="No pudimos cargar el reto" description={error} actionLabel="Reintentar" onAction={retry} />;
    }
    if (!challenge) {
      return <ContentState kind="empty" title="Esta semana no hay reto" description="Vuelve el lunes para el siguiente." />;
    }
    const progress = challenge.progress ?? { completed: 0, total: challenge.tasks.length, percent: 0 };
    const history = challenge.history ?? [];
    return (
      <>
        <Appear>
          <CoralCard radius={24} style={styles.card}>
            <Text style={[coralText.caption, { color: c.ink2 }]}>
              Del {shortDay(challenge.start)} al {shortDay(challenge.end)}{challenge.daysLeft !== undefined ? ` · ${daysLeftText(challenge.daysLeft)}` : ''}
            </Text>
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>{challenge.title}</Text>
            {challenge.description ? <Text style={[coralText.body, { color: c.ink2 }]}>{challenge.description}</Text> : null}
            <ScoreBar
              label="Avance de la semana"
              value={progress.percent / 100}
              detail={`${progress.completed} de ${progress.total} tareas completadas`}
            />
            {challenge.streak ? (
              <View style={styles.chips}>
                <Chip
                  label={challenge.streak === 1 ? '1 semana completa seguida' : `${challenge.streak} semanas completas seguidas`}
                  icon={<Flame size={14} color={c.ink} />}
                />
              </View>
            ) : null}
          </CoralCard>
        </Appear>

        <SectionTitle>Tareas</SectionTitle>
        <View style={styles.list}>
          {challenge.tasks.map((task, i) => {
            const done = Boolean(task.completedAt);
            const route = task.action ? ACTION_ROUTES[task.action] : undefined;
            return (
              <Appear key={task.id} delay={60 + i * 50}>
                <CoralCard radius={24} style={styles.taskCard}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done, busy: saving === task.id }}
                    accessibilityLabel={task.title}
                    accessibilityHint={done ? 'Toca para desmarcarla' : 'Toca para marcarla como hecha'}
                    disabled={Boolean(saving)}
                    onPress={() => { void toggle(task); }}
                    style={({ pressed }) => [styles.taskRow, pressed && { opacity: 0.7 }]}
                  >
                    {saving === task.id ? (
                      <ActivityIndicator color={c.ink} />
                    ) : done ? (
                      <CircleCheck size={24} color={c.ink} strokeWidth={2.2} />
                    ) : (
                      <Circle size={24} color={c.ink2} strokeWidth={2.2} />
                    )}
                    <View style={styles.flex}>
                      <Text style={[coralText.strong, { color: done ? c.ink2 : c.ink, textDecorationLine: done ? 'line-through' : 'none' }]}>
                        {task.title}
                      </Text>
                      {task.description ? <Text style={[coralText.small, { color: c.ink2 }]}>{task.description}</Text> : null}
                    </View>
                  </Pressable>
                  {route && !done ? (
                    <CoralLink
                      title="Hacerlo ahora"
                      underline
                      accessibilityLabel={`Hacer ahora: ${task.title}`}
                      onPress={() => router.push(route as never)}
                      style={styles.go}
                    />
                  ) : null}
                </CoralCard>
              </Appear>
            );
          })}
        </View>

        {history.length ? (
          <>
            <SectionTitle>Semanas anteriores</SectionTitle>
            <CoralCard radius={24} style={styles.card}>
              {history.map((h) => (
                <ScoreBar
                  key={h.id}
                  label={h.title}
                  value={h.percent / 100}
                  detail={`Del ${shortDay(h.start)} al ${shortDay(h.end)} · ${h.completed} de ${h.total} tareas`}
                />
              ))}
            </CoralCard>
          </>
        ) : null}
      </>
    );
  };

  return (
    <CoralScreen>
      <PageHeader title="Reto de la" titleAccent="semana" compact onBack={() => router.back()} description="Pequeñas tareas para mejorar tu imagen cada semana." />
      {renderBody()}
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 12 },
  taskCard: { gap: 4 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44 },
  go: { alignSelf: 'flex-start', marginLeft: 36, paddingHorizontal: 0 },
});
