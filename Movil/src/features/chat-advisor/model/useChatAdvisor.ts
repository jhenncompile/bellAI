import { useState, useCallback, useEffect } from 'react';
import { ChatMessage, SuggestionPill } from '@/entities/chat/model/types';
import { advisorService } from '../api/advisorService';
import { friendlyMessage } from '@/shared/api/http';
import { bellaiService } from '@/features/bellai/api/bellaiService';
import {
  buildLocalRecommendationReason,
  formatContextSummaryLine,
  gatherFullUserContext,
} from '@/features/bellai/model/userContextAggregator';
import type {
  ConsideredFactorItem,
  StoredAdvisorMessage,
} from '@/features/bellai/storage/bellaiHistoryStorage';
import { hapticFeedback } from '@/shared/lib/haptics';

export const DEFAULT_SUGGESTIONS: SuggestionPill[] = [
  {
    id: '1',
    label: 'Combinar mi armario hoy',
    prompt: '¿Qué combinación me recomiendas hoy usando las prendas y colores de mi armario?',
  },
  {
    id: '2',
    label: 'Colores que me favorecen',
    prompt: '¿Qué colores de ropa y accesorios resaltan mejor mi tono de piel y estación?',
  },
  {
    id: '3',
    label: 'Corte y maquillaje ideal',
    prompt: '¿Qué corte de cabello y tonos de maquillaje me favorecen según mi rostro y subtono?',
  },
  {
    id: '4',
    label: 'Look para ocasión especial',
    prompt: 'Recomiéndame un conjunto elegante para una ocasión formal según mi estilo personal.',
  },
];

const createWelcomeMessage = (): ChatMessage => ({
  id: 'init-1',
  sender: 'assistant',
  text: 'Hola, soy tu asesora experta en moda, belleza femenina, colorimetría y estilo personal. Conozco tu paleta, tu rostro y tu armario. ¿Qué te gustaría consultar hoy?',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
});

export const useChatAdvisor = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedText, setFailedText] = useState('');
  const [activeContextSummary, setActiveContextSummary] = useState<string>('');
  const [reasonModalState, setReasonModalState] = useState<{
    visible: boolean;
    title: string;
    reasonSummary: string;
    consideredFactors: ConsideredFactorItem[];
  }>({
    visible: false,
    title: '',
    reasonSummary: '',
    consideredFactors: [],
  });

  const refreshContext = useCallback(async () => {
    try {
      const ctx = await gatherFullUserContext();
      setActiveContextSummary(formatContextSummaryLine(ctx));
    } catch {
      setActiveContextSummary('');
    }
  }, []);

  useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  // Historial de la última conversación guardada en el servidor (HU-028)
  useEffect(() => {
    let alive = true;
    advisorService.restore().then((history) => {
      if (!alive || !history.length) return;
      setMessages((prev) => [
        prev[0],
        ...history.map((m) => ({
          id: m.id,
          sender: m.sender === 'usuaria' ? ('user' as const) : ('assistant' as const),
          text: m.content,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })),
      ]);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const sendMessage = async (textToSend?: string, retry = false) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: nowTime,
    };

    const updatedHistory = retry ? messages : [...messages, userMsg];
    if (!retry) {
      setMessages(updatedHistory);
    }

    setError('');
    setFailedText('');
    setInputText('');
    setIsLoading(true);
    hapticFeedback.light();

    const storedSnapshot: StoredAdvisorMessage[] = updatedHistory
      .filter((m) => m.id !== 'init-1')
      .map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
        createdAt: new Date().toISOString(),
        reasonSummary: m.reasonSummary,
        consideredFactors: m.consideredFactors,
      }));

    try {
      // La respuesta sale del LLM local del servidor (HU-026); el «por qué» se arma con el contexto real
      const [reply, ctx] = await Promise.all([advisorService.ask(text), gatherFullUserContext().catch(() => null)]);
      const localReason = ctx
        ? buildLocalRecommendationReason(ctx, { title: text.slice(0, 60), category: 'general' })
        : { reasonSummary: '', consideredFactors: [] as ConsideredFactorItem[] };
      if (ctx) setActiveContextSummary(formatContextSummaryLine(ctx));
      const response = { reply, reasonSummary: localReason.reasonSummary, consideredFactors: localReason.consideredFactors };

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reasonSummary: response.reasonSummary,
        consideredFactors: response.consideredFactors,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      hapticFeedback.success();
    } catch (err: any) {
      // Aun cuando el servicio de IA no esté disponible, guardar la consulta en el historial local
      const fallbackConvId =
        bellaiService.getActiveConversationId() || `local-conv-${Date.now()}`;
      await bellaiService.persistLocalConversation(
        fallbackConvId,
        text,
        storedSnapshot,
        activeContextSummary,
      );

      setError(friendlyMessage(err, 'No pudimos preparar una respuesta. Vuelve a intentarlo.'));
      setFailedText(text);
      hapticFeedback.warning();
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = useCallback(() => {
    bellaiService.resetActiveConversation();
    advisorService.reset();
    setMessages([createWelcomeMessage()]);
    setError('');
    setFailedText('');
    setInputText('');
    void refreshContext();
  }, [refreshContext]);

  const resumeConversation = useCallback((loadedMessages: ChatMessage[]) => {
    if (loadedMessages.length > 0) {
      setMessages(loadedMessages);
      setError('');
      setFailedText('');
    }
  }, []);

  const openReasonForMessage = useCallback(async (msg: ChatMessage) => {
    const ctx = await gatherFullUserContext();
    const localReason = buildLocalRecommendationReason(ctx, {
      title: 'Recomendación de tu asesora BellAI',
      category: 'general',
    });

    setReasonModalState({
      visible: true,
      title: 'Recomendación de tu asesora BellAI',
      reasonSummary: msg.reasonSummary || localReason.reasonSummary,
      consideredFactors:
        msg.consideredFactors && msg.consideredFactors.length > 0
          ? msg.consideredFactors
          : localReason.consideredFactors,
    });
  }, []);

  const closeReasonModal = useCallback(() => {
    setReasonModalState((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    messages,
    inputText,
    setInputText,
    isLoading,
    suggestions: DEFAULT_SUGGESTIONS,
    sendMessage,
    error,
    retryMessage: () => {
      if (failedText) void sendMessage(failedText, true);
    },
    activeContextSummary,
    startNewConversation,
    resumeConversation,
    reasonModalState,
    openReasonForMessage,
    closeReasonModal,
  };
};
