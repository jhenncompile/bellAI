import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Send } from 'lucide-react-native';
import { Banner, InputText, TextArea, useNotice } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralChip,
  CoralLink,
  CoralScreen,
  CoralTitle,
  Mascot,
  coralText,
  useCoral,
  useCoralFieldStyles,
} from '@/shared/ui/coral';
import { friendlyMessage } from '@/shared/api/http';
import { incidentsApi } from '@/features/bellai/api/bellaiApi';

const TYPES = [
  { value: 'error', label: 'Algo falla' }, { value: 'analisis', label: 'Mi análisis' }, { value: 'armario', label: 'Armario' },
  { value: 'cuenta', label: 'Mi cuenta' }, { value: 'privacidad', label: 'Privacidad' }, { value: 'sugerencia', label: 'Sugerencia' },
];
const STATUS: Record<string, string> = { abierta: 'Recibida', en_proceso: 'En revisión', resuelta: 'Resuelta', cerrada: 'Cerrada' };

/** HU-031: la usuaria reporta un problema y ve la respuesta del equipo. */
export const ReportScreen: React.FC = () => {
  const c = useCoral();
  const router = useRouter();
  const { notify } = useNotice();
  const { iconColor: _iconColor, ...field } = useCoralFieldStyles();
  const [type, setType] = useState('error');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [mine, setMine] = useState<Awaited<ReturnType<typeof incidentsApi.mine>>>([]);

  const loadMine = useCallback(() => {
    incidentsApi.mine().then(setMine).catch(() => undefined);
  }, []);
  useEffect(loadMine, [loadMine]);

  const titleError = touched && title.trim().length < 4 ? 'Escribe un título de 4 caracteres o más.' : undefined;
  const descriptionError = touched && description.trim().length < 10 ? 'Cuéntanos qué pasó con 10 caracteres o más.' : undefined;

  const send = async () => {
    setTouched(true);
    if (title.trim().length < 4 || description.trim().length < 10) return;
    setSending(true);
    setSendError('');
    try {
      await incidentsApi.create({ type, title: title.trim(), description: description.trim(), context: { platform: Platform.OS, version: String(Platform.Version) } });
      setTitle('');
      setDescription('');
      setTouched(false);
      setSent(true);
      notify({ kind: 'success', message: 'Recibimos tu reporte.' });
      loadMine();
    } catch (err) {
      setSendError(friendlyMessage(err, 'No pudimos enviar el reporte. Inténtalo de nuevo.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <CoralScreen keyboard contentStyle={styles.content}>
      <View style={styles.titleRow}>
        <CoralBackButton onPress={() => router.back()} />
        <CoralTitle prefix="Reportar un " accent="problema" size={28} style={styles.flex} />
      </View>

      {sent ? (
        <Appear>
          <CoralCard radius={24} style={styles.done}>
            <Mascot pose="celebrando" height={140} enter="pop" />
            <Text accessibilityRole="header" style={[coralText.section, styles.center, { color: c.ink }]}>¡Gracias por avisarnos!</Text>
            <Text style={[coralText.body, styles.center, { fontSize: 15, color: c.ink2 }]}>
              Recibimos tu reporte. Te responderemos aquí, en «Mis reportes».
            </Text>
            <CoralButton title="Volver" onPress={() => router.back()} fullWidth />
            <CoralLink title="Enviar otro reporte" underline onPress={() => setSent(false)} />
          </CoralCard>
        </Appear>
      ) : (
        <>
          <Text style={[coralText.body, styles.intro, { fontSize: 15, color: c.ink2 }]}>Cuéntanos qué pasó para poder ayudarte.</Text>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Sobre qué es</Text>
            <View style={styles.wrap}>
              {TYPES.map((t) => {
                const on = type === t.value;
                return (
                  <Pressable
                    key={t.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={t.label}
                    onPress={() => setType(t.value)}
                    style={({ pressed }) => [
                      styles.chip,
                      on ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderColor: c.fieldStroke, borderWidth: 1 },
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    {on ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
                    <Text style={[coralText.label, { color: on ? c.onPrimary : c.ink }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <CoralCard radius={24} style={styles.fields}>
            <InputText
              {...field}
              label="Título"
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              placeholder="Ej. El análisis no termina"
              errorText={titleError}
            />
            <TextArea
              {...field}
              label="Qué pasó"
              value={description}
              onChangeText={setDescription}
              maxLength={4000}
              showCharCount={false}
              minHeight={120}
              placeholder="Describe los pasos y lo que esperabas."
              errorText={descriptionError}
            />
          </CoralCard>

          {sendError ? <Banner kind="error" title="No se envió el reporte" description={sendError} actionLabel="Reintentar" onAction={() => { void send(); }} /> : null}

          <CoralButton
            title="Enviar reporte"
            leftIcon={<Send size={18} color={c.onPrimary} strokeWidth={2.2} />}
            onPress={() => { void send(); }}
            loading={sending}
            disabled={sending}
            fullWidth
          />
        </>
      )}

      {mine.length ? (
        <Appear delay={120} style={styles.section}>
          <Text accessibilityRole="header" style={[coralText.section, { color: c.ink }]}>Mis reportes</Text>
          {mine.map((i) => (
            <CoralCard key={i.id} radius={22} padding={14} style={styles.report}>
              <Text style={[coralText.strong, { color: c.ink }]}>{i.title}</Text>
              <View style={styles.reportMeta}>
                <CoralChip label={STATUS[i.status] ?? i.status} height={28} />
                <Text style={[coralText.caption, { color: c.ink2 }]}>
                  {new Date(i.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              {i.response ? <Text style={[coralText.small, { color: c.ink }]}>Respuesta: {i.response}</Text> : null}
            </CoralCard>
          ))}
        </Appear>
      ) : null}
    </CoralScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  intro: { paddingHorizontal: 4 },
  section: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  fields: { gap: 4 },
  done: { alignItems: 'center', gap: 10 },
  report: { gap: 6 },
  reportMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
