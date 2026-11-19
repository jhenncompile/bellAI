import type { ConsideredFactorItem } from '@/features/bellai/storage/bellaiHistoryStorage';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  reasonSummary?: string;
  consideredFactors?: ConsideredFactorItem[];
}

export interface SuggestionPill {
  id: string;
  label: string;
  prompt: string;
}
