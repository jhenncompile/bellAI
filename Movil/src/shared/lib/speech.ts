import type * as SpeechModule from 'expo-speech';

/**
 * Voz para las indicaciones (escaneo del avatar). expo-speech es un módulo nativo: si la app se
 * compiló antes de añadirlo, no existe y las indicaciones quedan solo en pantalla y con vibración.
 */
let Speech: typeof SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Speech = require('expo-speech');
} catch {
  Speech = null;
}

export const voice = {
  available: () => Speech !== null,
  say(text: string) {
    if (!Speech) return;
    try {
      Speech.stop();
      Speech.speak(text, { language: 'es-ES', rate: 1.0 });
    } catch {
      // Sin motor de voz en el teléfono: seguimos con texto y vibración
    }
  },
  stop() {
    try {
      Speech?.stop();
    } catch {}
  },
};
