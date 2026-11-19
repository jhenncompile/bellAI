import * as Sharing from 'expo-sharing';
import { Share, Platform } from 'react-native';

export const shareMedia = async (fileUri: string, message?: string): Promise<boolean> => {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable && Platform.OS !== 'web') {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir mi análisis de estilo',
        UTI: 'public.png',
      });
      return true;
    } else {
      // Fallback a Share estándar de React Native
      const result = await Share.share({
        message: message || 'Compartiendo mi análisis de estilo en BellAI',
        url: fileUri,
      });
      return result.action !== Share.dismissedAction;
    }
  } catch (error: any) {
    // Si la usuaria descartó el diálogo de compartir, no mostrar mensaje de error
    const errorMessage = error?.message?.toLowerCase?.() || '';
    if (errorMessage.includes('cancel') || errorMessage.includes('dismiss')) {
      return false;
    }

    console.error('[shareMedia] Error al compartir:', error);
    // Quien llama decide cómo avisar (sistema P1: aviso breve, no Alert nativo).
    throw error;
  }
};
