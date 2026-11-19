import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiagnosticResult } from '@/entities/diagnostic/model/types';

export interface ConsideredFactorItem {
  category: 'colorimetria' | 'rostro' | 'armario' | 'estilo' | 'ocasion';
  label: string;
  value: string;
}

export interface StoredAdvisorMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  createdAt: string;
  reasonSummary?: string;
  consideredFactors?: ConsideredFactorItem[];
}

export interface StoredConversationItem {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredAdvisorMessage[];
  contextSummary?: string;
}

export interface StoredOutfitItem {
  id: string;
  title: string;
  occasion: string;
  season: string;
  garmentNames: string[];
  colors: string[];
  reasonSummary: string;
  consideredFactors: ConsideredFactorItem[];
  createdAt: string;
}

export interface StoredDiagnosticHistoryItem {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  diagnostic: DiagnosticResult;
}

const KEYS = {
  CONVERSATIONS: '@bellai_history_conversations_v1',
  OUTFITS: '@bellai_history_outfits_v1',
  DIAGNOSTICS: '@bellai_history_diagnostics_v1',
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignorar fallos de almacenamiento local sin interrumpir flujo
  }
}

export const bellaiHistoryStorage = {
  async listConversations(): Promise<StoredConversationItem[]> {
    const list = await readJson<StoredConversationItem[]>(KEYS.CONVERSATIONS, []);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async saveConversation(conversation: StoredConversationItem): Promise<void> {
    const list = await readJson<StoredConversationItem[]>(KEYS.CONVERSATIONS, []);
    const filtered = list.filter((c) => c.id !== conversation.id);
    await writeJson(KEYS.CONVERSATIONS, [conversation, ...filtered].slice(0, 40));
  },

  async deleteConversation(id: string): Promise<void> {
    const list = await readJson<StoredConversationItem[]>(KEYS.CONVERSATIONS, []);
    await writeJson(
      KEYS.CONVERSATIONS,
      list.filter((c) => c.id !== id),
    );
  },

  async listOutfits(): Promise<StoredOutfitItem[]> {
    const list = await readJson<StoredOutfitItem[]>(KEYS.OUTFITS, []);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async saveOutfit(outfit: StoredOutfitItem): Promise<void> {
    const list = await readJson<StoredOutfitItem[]>(KEYS.OUTFITS, []);
    const filtered = list.filter((o) => o.id !== outfit.id);
    await writeJson(KEYS.OUTFITS, [outfit, ...filtered].slice(0, 40));
  },

  async deleteOutfit(id: string): Promise<void> {
    const list = await readJson<StoredOutfitItem[]>(KEYS.OUTFITS, []);
    await writeJson(
      KEYS.OUTFITS,
      list.filter((o) => o.id !== id),
    );
  },

  async listDiagnostics(): Promise<StoredDiagnosticHistoryItem[]> {
    const list = await readJson<StoredDiagnosticHistoryItem[]>(KEYS.DIAGNOSTICS, []);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async saveDiagnostic(diagnostic: DiagnosticResult): Promise<void> {
    const list = await readJson<StoredDiagnosticHistoryItem[]>(KEYS.DIAGNOSTICS, []);
    const id = diagnostic.id || `diag-${Date.now()}`;
    const item: StoredDiagnosticHistoryItem = {
      id,
      title: `${diagnostic.season} · Rostro ${diagnostic.faceShape}`,
      subtitle: `Tono ${diagnostic.skinTone} · Subtono ${diagnostic.undertone}`,
      createdAt: new Date().toISOString(),
      diagnostic,
    };
    const filtered = list.filter((d) => d.id !== id);
    await writeJson(KEYS.DIAGNOSTICS, [item, ...filtered].slice(0, 30));
  },

  async deleteDiagnostic(id: string): Promise<void> {
    const list = await readJson<StoredDiagnosticHistoryItem[]>(KEYS.DIAGNOSTICS, []);
    await writeJson(
      KEYS.DIAGNOSTICS,
      list.filter((d) => d.id !== id),
    );
  },
};
