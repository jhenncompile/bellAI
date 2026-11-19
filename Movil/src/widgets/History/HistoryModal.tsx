import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Eye, MessageCircle, ScanFace, Shirt, Trash2 } from 'lucide-react-native';
import { Banner, ButtonDanger, ContentState, Dialog } from '@/shared/ui';
import {
  Appear,
  CoralBackButton,
  CoralButton,
  CoralCard,
  CoralIconBox,
  CoralLink,
  CoralScreen,
  CoralTitle,
  coralFonts,
  coralText,
  useCoral,
} from '@/shared/ui/coral';
import { useTheme } from '@/shared/theme';
import {
  bellaiService,
  type HistoryCategoryFilter,
  type UnifiedHistoryCardItem,
} from '@/features/bellai/api/bellaiService';
import {
  buildLocalRecommendationReason,
  gatherFullUserContext,
} from '@/features/bellai/model/userContextAggregator';
import type { ConsideredFactorItem } from '@/features/bellai/storage/bellaiHistoryStorage';
import { RecommendationReasonModal } from '../RecommendationReason/RecommendationReasonModal';
import { NoticeOutlet } from '@/shared/ui/Notice';

/** Tinta fija sobre los iconos pastel. */
const TILE_INK = '#2A1714';

export interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onResumeConsultation?: (messages: { id: string; sender: 'user' | 'assistant'; text: string; timestamp: string }[]) => void;
}

const FILTERS: { key: HistoryCategoryFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'diagnostic', label: 'Diagnósticos' },
  { key: 'outfit', label: 'Combinaciones' },
  { key: 'consultation', label: 'Consultas' },
];

const TYPE = {
  diagnostic: { label: 'Diagnóstico', Icon: ScanFace, tile: 0 },
  outfit: { label: 'Combinación', Icon: Shirt, tile: 1 },
  consultation: { label: 'Consulta', Icon: MessageCircle, tile: 2 },
} as const;

/** Fecha legible: «Hoy, 14:30», «Ayer, 09:10» o «12 nov, 18:00». */
function readableDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Hoy, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ayer, ${time}`;
  const sameYear = d.getFullYear() === today.getFullYear();
  return `${d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}, ${time}`;
}

const isUser = (m: any) => m.sender === 'user' || m.role === 'user';

/** Historial unificado (sistema P1): diagnósticos, combinaciones y consultas, con detalle y motivo. */
export const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onClose,
  onResumeConsultation,
}) => {
  const c = useCoral();
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<HistoryCategoryFilter>('all');
  // `null` mientras se consulta.
  const [items, setItems] = useState<UnifiedHistoryCardItem[] | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<UnifiedHistoryCardItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<{
    card: UnifiedHistoryCardItem;
    detail: any;
  } | null>(null);
  const [reasonModalData, setReasonModalData] = useState<{
    visible: boolean;
    title: string;
    reasonSummary: string;
    consideredFactors: ConsideredFactorItem[];
    contextSummary: string;
  }>({
    visible: false,
    title: '',
    reasonSummary: '',
    consideredFactors: [],
    contextSummary: '',
  });

  // Solo cambia estado al terminar; quien recarga limpia antes `items` y `error`.
  const loadHistory = useCallback(() => {
    bellaiService.getUnifiedHistory(filter)
      .then((list) => {
        setError('');
        setItems(list);
      })
      .catch(() => setError('Revisa tu conexión e inténtalo de nuevo.'));
  }, [filter]);

  useEffect(() => {
    if (visible) loadHistory();
  }, [visible, loadHistory]);

  const reload = () => { setError(''); setItems(null); loadHistory(); };
  const changeFilter = (next: HistoryCategoryFilter) => {
    if (next === filter) return;
    setError('');
    setItems(null);
    setFilter(next);
  };
  // Al cerrar se limpia la vista para que al volver a abrir empiece en la lista.
  const close = () => {
    setSelectedDetail(null);
    setActionError('');
    setItems(null);
    onClose();
  };

  const handleOpenDetail = async (card: UnifiedHistoryCardItem) => {
    try {
      const detail = await bellaiService.getHistoryItemDetail(card.type, card.id);
      setSelectedDetail({ card, detail: detail || card.payload });
    } catch {
      setSelectedDetail({ card, detail: card.payload });
    }
  };

  const handleShowReason = async (card: UnifiedHistoryCardItem) => {
    const ctx = await gatherFullUserContext();
    const fallback = buildLocalRecommendationReason(ctx, {
      title: card.title,
      category: card.type === 'outfit' ? 'armario' : 'general',
    });

    setReasonModalData({
      visible: true,
      title: card.title,
      reasonSummary: card.reasonSummary || fallback.reasonSummary,
      consideredFactors:
        card.consideredFactors && card.consideredFactors.length > 0
          ? card.consideredFactors
          : fallback.consideredFactors,
      contextSummary: fallback.contextBadgeText,
    });
  };

  const confirmDelete = async () => {
    const card = pendingDelete;
    if (!card) return;
    setDeleting(true);
    setActionError('');
    try {
      await bellaiService.deleteHistoryItem(card.type, card.id);
      setItems((prev) => (prev ?? []).filter((i) => !(i.id === card.id && i.type === card.type)));
      if (selectedDetail?.card.id === card.id) setSelectedDetail(null);
    } catch {
      setActionError(`No se pudo eliminar «${card.title}». Inténtalo de nuevo.`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const goHome = () => {
    close();
    router.navigate('/');
  };

  const renderList = () => {
    if (items === null && !error) {
      return <ContentState kind="loading" loading title="Cargando tu historial" description="Recuperando tus diagnósticos, combinaciones y consultas." />;
    }
    if (error) {
      return <Banner kind="error" title="No pudimos abrir tu historial" description={error} actionLabel="Reintentar" onAction={reload} />;
    }
    if (!items || items.length === 0) {
      return filter === 'all' ? (
        <ContentState
          kind="empty"
          title="Aún no tienes historial"
          description="Cuando hagas un diagnóstico, guardes combinaciones o consultes a la asistente, aparecerán aquí por fecha."
          actionLabel="Ir a Inicio"
          onAction={goHome}
        />
      ) : (
        <ContentState
          kind="empty"
          title="Nada en esta categoría"
          description="Prueba con «Todos» para ver el resto de tu actividad."
          actionLabel="Ver todos"
          onAction={() => changeFilter('all')}
        />
      );
    }
    return items.map((item, index) => {
      const meta = TYPE[item.type];
      const date = readableDate(item.createdAt);
      return (
        <Appear key={`${item.type}-${item.id}`} delay={Math.min(index, 6) * 40}>
          <CoralCard radius={22} padding={14} style={styles.item}>
            <View style={styles.itemHead}>
              <CoralIconBox gradient={c.tiles[meta.tile]} size={44}>
                <meta.Icon size={20} color={TILE_INK} strokeWidth={2.2} />
              </CoralIconBox>
              <View style={styles.flex}>
                <Text style={[coralText.caption, { fontFamily: coralFonts.bold, color: c.ink2 }]}>
                  {meta.label}{date ? ` · ${date}` : ''}
                </Text>
                <Text style={[coralText.strong, { color: c.ink }]} numberOfLines={2}>{item.title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${item.title} del historial`}
                onPress={() => setPendingDelete(item)}
                style={({ pressed }) => [styles.iconButton, { backgroundColor: c.dangerBg }, pressed && { opacity: 0.7 }]}
              >
                <Trash2 size={18} color={c.danger} strokeWidth={2.2} />
              </Pressable>
            </View>
            {item.subtitle ? (
              <Text numberOfLines={3} style={[coralText.small, { color: c.ink2 }]}>{item.subtitle}</Text>
            ) : null}
            <View style={styles.actions}>
              <CoralButton
                title="Abrir"
                variant="secondary"
                height={44}
                leftIcon={<Eye size={16} color={c.ink} strokeWidth={2.2} />}
                onPress={() => { void handleOpenDetail(item); }}
                accessibilityLabel={`Abrir ${item.title} sin repetir el análisis`}
              />
              <CoralLink
                title="¿Por qué?"
                underline
                onPress={() => { void handleShowReason(item); }}
                accessibilityLabel={`Motivo de la recomendación ${item.title}`}
              />
            </View>
          </CoralCard>
        </Appear>
      );
    });
  };

  const renderDetail = () => {
    if (!selectedDetail) return null;
    const { card, detail } = selectedDetail;
    const meta = TYPE[card.type];
    const date = readableDate(card.createdAt);
    const diagnosticTraits = detail
      ? [
        detail.faceShape ? `Rostro: ${detail.faceShape}` : '',
        detail.skinTone ? `Tono: ${detail.skinTone}` : '',
        detail.undertone ? `Subtono: ${detail.undertone}` : '',
      ].filter(Boolean).join(' · ')
      : '';
    const outfitMeta = detail
      ? [
        detail.occasion ? `Ocasión: ${detail.occasion}` : '',
        detail.season ? `Estación: ${detail.season}` : '',
      ].filter(Boolean).join(' · ')
      : '';
    const messages: any[] = card.type === 'consultation' && Array.isArray(detail?.messages) ? detail.messages : [];

    return (
      <Appear>
        <CoralCard radius={24} style={styles.detail}>
          <View style={styles.itemHead}>
            <CoralIconBox gradient={c.tiles[meta.tile]} size={44}>
              <meta.Icon size={20} color={TILE_INK} strokeWidth={2.2} />
            </CoralIconBox>
            <Text style={[coralText.caption, styles.flex, { fontFamily: coralFonts.bold, color: c.ink2 }]}>
              {meta.label} guardado{date ? ` · ${date}` : ''}
            </Text>
          </View>
          <Text accessibilityRole="header" style={[styles.detailTitle, { color: c.ink }]}>{card.title}</Text>

          {card.type === 'diagnostic' && detail ? (
            <View style={styles.block}>
              {detail.season || detail.seasonalPalette ? (
                <Text style={[coralText.strong, { color: c.ink }]}>Estación: {detail.season || detail.seasonalPalette}</Text>
              ) : null}
              {diagnosticTraits ? <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>{diagnosticTraits}</Text> : null}
              {Array.isArray(detail.palette) && detail.palette.length > 0 ? (
                <Text style={[coralText.small, { color: c.ink }]}>
                  Paleta recomendada: {detail.palette.map((p: any) => p.name || p).join(', ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {card.type === 'outfit' && detail ? (
            <View style={styles.block}>
              {outfitMeta ? <Text style={[coralText.strong, { color: c.ink }]}>{outfitMeta}</Text> : null}
              {Array.isArray(detail.garmentNames) && detail.garmentNames.length > 0 ? (
                <Text style={[coralText.body, { fontSize: 15, color: c.ink2 }]}>Prendas: {detail.garmentNames.join(' + ')}</Text>
              ) : null}
              {detail.reasonSummary ? (
                <Text style={[coralText.small, { color: c.ink }]}>Motivo: {detail.reasonSummary}</Text>
              ) : null}
            </View>
          ) : null}

          {messages.length > 0 ? (
            <View style={styles.block}>
              {messages.map((m: any, index: number) => {
                const mine = isUser(m);
                return (
                  <View
                    key={m.id || `msg-${index}`}
                    style={[styles.bubble, mine ? { backgroundColor: c.primary, alignSelf: 'flex-end' } : { backgroundColor: c.muted, alignSelf: 'flex-start' }]}
                  >
                    <Text style={[coralText.caption, { fontFamily: coralFonts.extrabold, color: mine ? c.onPrimary : c.ink }]}>
                      {mine ? 'Tú' : 'Asistente BellAI'}
                    </Text>
                    <Text style={[coralText.small, { color: mine ? c.onPrimary : c.ink }]}>{m.text || m.content}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.detailActions}>
            {messages.length > 0 && onResumeConsultation ? (
              <CoralButton
                title="Continuar en el asistente"
                onPress={() => {
                  const mapped = messages.map((m: any, i: number) => ({
                    id: m.id || `hist-${i}`,
                    sender: (m.sender || m.role) === 'user' ? ('user' as const) : ('assistant' as const),
                    text: m.text || m.content,
                    timestamp: m.timestamp || '',
                    reasonSummary: m.reasonSummary || m.metadata?.reasonSummary,
                    consideredFactors: m.consideredFactors || m.metadata?.consideredFactors,
                  }));
                  onResumeConsultation(mapped);
                  close();
                }}
                fullWidth
              />
            ) : null}
            <CoralButton
              title="¿Por qué esta recomendación?"
              variant="secondary"
              onPress={() => { void handleShowReason(card); }}
              fullWidth
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${card.title} del historial`}
              onPress={() => setPendingDelete(card)}
              style={({ pressed }) => [styles.dangerLink, pressed && { opacity: 0.6 }]}
            >
              <Trash2 size={18} color={c.danger} strokeWidth={2.2} />
              <Text style={[coralText.label, { fontSize: 15.5, color: c.danger, textDecorationLine: 'underline' }]}>Eliminar del historial</Text>
            </Pressable>
          </View>
        </CoralCard>
      </Appear>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => (selectedDetail ? setSelectedDetail(null) : close())}>
      <CoralScreen contentStyle={styles.content}>
        <View style={styles.titleRow}>
          <CoralBackButton
            label={selectedDetail ? 'Volver a la lista del historial' : 'Cerrar historial'}
            onPress={() => (selectedDetail ? setSelectedDetail(null) : close())}
          />
          <CoralTitle prefix="Mi " accent="historial" size={28} style={styles.flex} />
        </View>

        {!selectedDetail ? (
          <>
            <Text style={[coralText.body, styles.intro, { fontSize: 15, color: c.ink2 }]}>
              Vuelve a tus diagnósticos, combinaciones y preguntas sin repetir el análisis.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Ver ${f.label.toLowerCase()}`}
                    onPress={() => changeFilter(f.key)}
                    style={({ pressed }) => [
                      styles.chip,
                      on ? { backgroundColor: c.primary } : { backgroundColor: c.card, borderColor: c.fieldStroke, borderWidth: 1 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {on ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
                    <Text style={[coralText.label, { color: on ? c.onPrimary : c.ink }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {actionError ? <Banner kind="error" title="No se eliminó" description={actionError} /> : null}

        <View style={styles.list}>{selectedDetail ? renderDetail() : renderList()}</View>
      </CoralScreen>

      <Dialog
        visible={Boolean(pendingDelete)}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
        titlePrefix="¿Eliminar del "
        titleAccent="historial"
        titleSuffix="?"
        description={pendingDelete ? `Se borrará «${pendingDelete.title}» de tu historial. No se puede deshacer.` : undefined}
        actions={<>
          <ButtonDanger
            title="Eliminar"
            leftIcon={<Trash2 size={18} color={colors.text.onDanger} strokeWidth={2.2} />}
            loading={deleting}
            disabled={deleting}
            onPress={() => { void confirmDelete(); }}
            fullWidth
          />
          <CoralButton title="Cancelar" variant="secondary" disabled={deleting} onPress={() => setPendingDelete(null)} fullWidth />
        </>}
      />

      <RecommendationReasonModal
        visible={reasonModalData.visible}
        onClose={() => setReasonModalData((prev) => ({ ...prev, visible: false }))}
        recommendationTitle={reasonModalData.title}
        reasonSummary={reasonModalData.reasonSummary}
        consideredFactors={reasonModalData.consideredFactors}
        contextSummary={reasonModalData.contextSummary}
      />
      <NoticeOutlet />
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  intro: { paddingHorizontal: 4 },
  filters: { gap: 8, paddingVertical: 2 },
  chip: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  list: { gap: 10 },
  item: { gap: 10 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  detail: { gap: 12 },
  detailTitle: { fontFamily: coralFonts.title, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  block: { gap: 8 },
  bubble: { padding: 12, borderRadius: 18, gap: 2, maxWidth: '88%' },
  detailActions: { gap: 4, alignItems: 'center', marginTop: 4 },
  dangerLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 8 },
});
