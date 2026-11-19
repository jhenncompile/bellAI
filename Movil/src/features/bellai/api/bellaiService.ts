import { apiClient } from '@/shared/api/apiClient';
import type { DiagnosticResult } from '@/entities/diagnostic/model/types';
import {
  bellaiHistoryStorage,
  type ConsideredFactorItem,
  type StoredAdvisorMessage,
  type StoredConversationItem,
  type StoredOutfitItem,
} from '../storage/bellaiHistoryStorage';

type RemoteDiagnostic = {
  id: string;
  details: DiagnosticResult;
  createdAt: string;
};

/** Pantalla de la app donde se hace una tarea del reto (HU-28). */
export type ChallengeAction = 'studio' | 'wardrobe' | 'outfits' | 'style' | 'simulator' | 'advisor' | 'compatibility' | 'profile';

export type RemoteChallenge = {
  id: string;
  title: string;
  description: string | null;
  /** Fechas sin hora (AAAA-MM-DD) */
  start: string;
  end: string;
  tasks: { id: string; title: string; description?: string | null; action?: ChallengeAction | null; order: number; completedAt: string | null }[];
  /** HU-28: avance de la semana, retos anteriores y semanas completas seguidas */
  daysLeft?: number;
  progress?: { completed: number; total: number; percent: number };
  history?: { id: string; title: string; start: string; end: string; completed: number; total: number; percent: number }[];
  streak?: number;
};

export type HistoryCategoryFilter = 'all' | 'diagnostic' | 'outfit' | 'consultation';

export interface UnifiedHistoryCardItem {
  id: string;
  type: 'diagnostic' | 'outfit' | 'consultation';
  title: string;
  subtitle: string;
  createdAt: string;
  reasonSummary?: string;
  consideredFactors?: ConsideredFactorItem[];
  payload?: any;
}

let conversationId: string | null = null;

/** API del modelo BellAI; sincroniza con el backend y conserva el historial de la usuaria. */
export const bellaiService = {
  getActiveConversationId(): string | null {
    return conversationId;
  },

  resetActiveConversation(): void {
    conversationId = null;
  },

  async isPhotoConsentGranted(): Promise<boolean> {
    const { data } = await apiClient.get<{ authorized: boolean }>('/bellai/photo-consent');
    return data.authorized;
  },

  async updatePhotoConsent(authorized: boolean, policyVersion = 'v1.0') {
    const { data } = await apiClient.patch('/bellai/photo-consent', { authorized, policyVersion });
    return data;
  },

  async saveDiagnostic(diagnostic: DiagnosticResult): Promise<void> {
    await bellaiHistoryStorage.saveDiagnostic(diagnostic);
    try {
      const consentGranted = await this.isPhotoConsentGranted();
      if (!consentGranted) return;
      await apiClient.post('/bellai/diagnostics', {
        faceShape: diagnostic.faceShape,
        skinTone: diagnostic.skinTone,
        undertone: diagnostic.undertone,
        seasonalPalette: diagnostic.season,
        summary: `Análisis personal de ${diagnostic.season} (${diagnostic.faceShape}).`,
        proportions: diagnostic.biometricMetrics || {},
        hairFeatures: diagnostic.hairAdvice || {},
        details: diagnostic,
      });
    } catch {
      // Ya quedó guardado en el historial local
    }
  },

  async getLatestDiagnostic(): Promise<RemoteDiagnostic | null> {
    try {
      const { data } = await apiClient.get<RemoteDiagnostic[]>('/bellai/diagnostics');
      if (data && data.length > 0) return data[0];
    } catch {
      // Recurrir a caché local
    }
    const local = await bellaiHistoryStorage.listDiagnostics();
    if (local.length > 0) {
      return {
        id: local[0].id,
        details: local[0].diagnostic,
        createdAt: local[0].createdAt,
      };
    }
    return null;
  },

  async saveOutfitToHistory(outfit: Omit<StoredOutfitItem, 'id' | 'createdAt'>): Promise<StoredOutfitItem> {
    let remoteId = `outfit-${Date.now()}`;
    let remoteCreatedAt = new Date().toISOString();
    let finalReason = outfit.reasonSummary;
    let finalFactors = outfit.consideredFactors;

    try {
      const { data } = await apiClient.post<any>('/bellai/outfits', {
        title: outfit.title,
        occasion: outfit.occasion,
        season: outfit.season,
        garmentIds: [],
        colorHarmony: outfit.colors.join(', '),
        notes: outfit.garmentNames.join(' + '),
      });
      if (data?.id) remoteId = data.id;
      if (data?.createdAt) remoteCreatedAt = data.createdAt;
      if (data?.reasonSummary) finalReason = data.reasonSummary;
      if (Array.isArray(data?.consideredFactors) && data.consideredFactors.length > 0) {
        finalFactors = data.consideredFactors;
      }
    } catch {
      // Se conserva en almacenamiento local si no hay red
    }

    const stored: StoredOutfitItem = {
      id: remoteId,
      title: outfit.title,
      occasion: outfit.occasion,
      season: outfit.season,
      garmentNames: outfit.garmentNames,
      colors: outfit.colors,
      reasonSummary: finalReason,
      consideredFactors: finalFactors,
      createdAt: remoteCreatedAt,
    };
    await bellaiHistoryStorage.saveOutfit(stored);
    return stored;
  },

  async explainRecommendation(payload: {
    recommendationType: 'outfit' | 'garment' | 'color' | 'hair' | 'makeup' | 'general';
    title?: string;
    occasion?: string;
    garmentIds?: string[];
    colors?: string[];
  }): Promise<{ reasonSummary: string; consideredFactors: ConsideredFactorItem[] } | null> {
    try {
      const { data } = await apiClient.post<{
        reasonSummary: string;
        consideredFactors: ConsideredFactorItem[];
      }>('/bellai/recommendations/explain', payload);
      return data;
    } catch {
      return null;
    }
  },

  async askAdvisor(content: string): Promise<string> {
    const res = await this.askAdvisorDetailed(content);
    return res.content;
  },

  async askAdvisorDetailed(
    content: string,
    rawQuestion?: string,
    localMessagesSnapshot?: StoredAdvisorMessage[],
    contextSummary?: string,
  ): Promise<{
    content: string;
    conversationId: string;
    reasonSummary?: string;
    consideredFactors?: ConsideredFactorItem[];
  }> {
    if (!conversationId) {
      const { data } = await apiClient.post<{ id: string }>('/bellai/conversations', {
        title: (rawQuestion || content).slice(0, 70) || 'Asesora personal BellAI',
      });
      conversationId = data.id;
    }

    const { data } = await apiClient.post<{
      assistant: { content: string; metadata?: any };
      explanation?: { reasonSummary?: string; consideredFactors?: ConsideredFactorItem[] };
    }>(`/bellai/conversations/${conversationId}/messages`, { content });

    const replyText = data.assistant.content;
    const reasonSummary =
      data.explanation?.reasonSummary || data.assistant?.metadata?.reasonSummary;
    const consideredFactors =
      data.explanation?.consideredFactors || data.assistant?.metadata?.consideredFactors;

    if (localMessagesSnapshot && conversationId) {
      const nowIso = new Date().toISOString();
      const convItem: StoredConversationItem = {
        id: conversationId,
        title: (rawQuestion || 'Consulta a BellAI').slice(0, 72),
        subtitle: contextSummary || 'Consulta sobre moda, colorimetría y estilo',
        createdAt: nowIso,
        updatedAt: nowIso,
        contextSummary,
        messages: [
          ...localMessagesSnapshot,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: nowIso,
            reasonSummary,
            consideredFactors,
          },
        ],
      };
      await bellaiHistoryStorage.saveConversation(convItem);
    }

    return {
      content: replyText,
      conversationId: conversationId,
      reasonSummary,
      consideredFactors,
    };
  },

  async persistLocalConversation(
    convId: string,
    title: string,
    messages: StoredAdvisorMessage[],
    contextSummary?: string,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    await bellaiHistoryStorage.saveConversation({
      id: convId,
      title: title.slice(0, 72),
      subtitle: contextSummary || 'Consulta guardada con tu asesora personal',
      createdAt: nowIso,
      updatedAt: nowIso,
      contextSummary,
      messages,
    });
  },

  async getUnifiedHistory(filter: HistoryCategoryFilter = 'all'): Promise<UnifiedHistoryCardItem[]> {
    const [localDiags, localOutfits, localConvs] = await Promise.all([
      bellaiHistoryStorage.listDiagnostics(),
      bellaiHistoryStorage.listOutfits(),
      bellaiHistoryStorage.listConversations(),
    ]);

    const map = new Map<string, UnifiedHistoryCardItem>();

    if (filter === 'all' || filter === 'diagnostic') {
      localDiags.forEach((d) => {
        map.set(`diagnostic:${d.id}`, {
          id: d.id,
          type: 'diagnostic',
          title: d.title,
          subtitle: d.subtitle,
          createdAt: d.createdAt,
          payload: d.diagnostic,
        });
      });
    }

    if (filter === 'all' || filter === 'outfit') {
      localOutfits.forEach((o) => {
        map.set(`outfit:${o.id}`, {
          id: o.id,
          type: 'outfit',
          title: o.title,
          subtitle: `${o.occasion} · ${o.garmentNames.join(' + ')}`,
          createdAt: o.createdAt,
          reasonSummary: o.reasonSummary,
          consideredFactors: o.consideredFactors,
          payload: o,
        });
      });
    }

    if (filter === 'all' || filter === 'consultation') {
      localConvs.forEach((c) => {
        const lastAssistant = [...c.messages].reverse().find((m) => m.sender === 'assistant');
        map.set(`consultation:${c.id}`, {
          id: c.id,
          type: 'consultation',
          title: c.title,
          subtitle: lastAssistant
            ? lastAssistant.text.slice(0, 90)
            : c.subtitle,
          createdAt: c.updatedAt || c.createdAt,
          reasonSummary: lastAssistant?.reasonSummary,
          consideredFactors: lastAssistant?.consideredFactors,
          payload: c,
        });
      });
    }

    try {
      const { data } = await apiClient.get<any[]>(`/bellai/history?type=${filter}`);
      if (Array.isArray(data)) {
        data.forEach((item) => {
          const key = `${item.type}:${item.id}`;
          if (!map.has(key)) {
            map.set(key, {
              id: item.id,
              type: item.type,
              title: item.title,
              subtitle: item.subtitle,
              createdAt: item.createdAt,
              reasonSummary: item.preview?.reasonSummary,
              consideredFactors: item.preview?.consideredFactors,
              payload: item.preview,
            });
          }
        });
      }
    } catch {
      // Mostrar historial local si el servidor no responde
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  async getHistoryItemDetail(
    type: 'diagnostic' | 'outfit' | 'consultation',
    id: string,
  ): Promise<any> {
    if (type === 'diagnostic') {
      const local = (await bellaiHistoryStorage.listDiagnostics()).find((d) => d.id === id);
      if (local) return local.diagnostic;
    }
    if (type === 'outfit') {
      const local = (await bellaiHistoryStorage.listOutfits()).find((o) => o.id === id);
      if (local) return local;
    }
    if (type === 'consultation') {
      const local = (await bellaiHistoryStorage.listConversations()).find((c) => c.id === id);
      if (local) return local;
    }

    const { data } = await apiClient.get<{ item: any }>(`/bellai/history/${type}/${id}`);
    return data.item;
  },

  async deleteHistoryItem(
    type: 'diagnostic' | 'outfit' | 'consultation',
    id: string,
  ): Promise<void> {
    if (type === 'diagnostic') await bellaiHistoryStorage.deleteDiagnostic(id);
    if (type === 'outfit') await bellaiHistoryStorage.deleteOutfit(id);
    if (type === 'consultation') await bellaiHistoryStorage.deleteConversation(id);

    try {
      await apiClient.delete(`/bellai/history/${type}/${id}`);
    } catch {
      // Ya se eliminó localmente
    }
  },

  async getActiveChallenge(): Promise<RemoteChallenge | null> {
    const { data } = await apiClient.get<RemoteChallenge | null>('/bellai/challenges/active');
    return data;
  },

  /** Marca o desmarca una tarea; devuelve el reto con el avance actualizado. */
  async setChallengeTask(taskId: string, completed: boolean): Promise<RemoteChallenge | null> {
    const { data } = await apiClient.patch<RemoteChallenge | null>(`/bellai/challenges/tasks/${taskId}`, { completed });
    return data;
  },
};
