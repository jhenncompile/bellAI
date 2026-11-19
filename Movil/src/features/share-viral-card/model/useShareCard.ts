import { useState, useRef } from 'react';
import { captureRef } from 'react-native-view-shot';
import { shareMedia } from '@/shared/lib/sharing';
import { hapticFeedback } from '@/shared/lib/haptics';
import { useNotice } from '@/shared/ui/Notice';

export interface ShareCardOptions {
  message?: string;
  season?: string;
}

export const useShareCard = () => {
  const [isSharing, setIsSharing] = useState(false);
  const { notify } = useNotice();
  const cardRef = useRef<any>(null);

  const captureAndShare = async (score: number, options?: ShareCardOptions): Promise<boolean> => {
    if (!cardRef.current) {
      console.warn('[useShareCard] cardRef no está disponible para captura.');
      return false;
    }

    setIsSharing(true);
    hapticFeedback.medium();

    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const message =
        options?.message ||
        `Mi análisis de estilo en BellAI: ${score}/100${
          options?.season ? ` (${options.season})` : ''
        }. Descubre tu paleta personal y colorimetría.`;

      const shared = await shareMedia(uri, message);
      if (shared) {
        hapticFeedback.success();
      }
      return shared;
    } catch (error) {
      console.error('[useShareCard] Error capturando tarjeta para redes:', error);
      hapticFeedback.warning();
      notify({ kind: 'error', message: 'No pudimos compartir tu tarjeta. Inténtalo de nuevo en un momento.' });
      return false;
    } finally {
      setIsSharing(false);
    }
  };

  return {
    cardRef,
    isSharing,
    captureAndShare,
  };
};
