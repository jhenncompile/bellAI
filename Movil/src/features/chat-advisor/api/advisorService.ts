import { assistantApi } from '@/features/bellai/api/bellaiApi';
import type { ChatMessageView } from '@/features/bellai/api/types';

/**
 * HU-026 / HU-027: asistente con modelo de lenguaje local en el servidor de BellAI.
 * Las respuestas usan el diagnóstico, el Style DNA y el armario real de la usuaria.
 * Si el modelo no está disponible, el servidor responde con reglas basadas en sus datos.
 */
let conversationId: string | null = null;

export const advisorService = {
  /** Recupera la conversación más reciente para mostrar el historial (HU-028). */
  async restore(): Promise<ChatMessageView[]> {
    const list = await assistantApi.conversations();
    if (!list.length) return [];
    conversationId = list[0].id;
    const conv = await assistantApi.get(conversationId);
    return conv.messages;
  },

  async ask(content: string): Promise<string> {
    if (!conversationId) conversationId = (await assistantApi.create('Asesora personal')).id;
    const res = await assistantApi.send(conversationId, content);
    return res.assistant.content;
  },

  /** Empieza una conversación nueva (la anterior queda en el historial). */
  reset() {
    conversationId = null;
  },
};

export const queryAdvisor = async (prompt: string): Promise<string> => {
  return advisorService.ask(prompt);
};
