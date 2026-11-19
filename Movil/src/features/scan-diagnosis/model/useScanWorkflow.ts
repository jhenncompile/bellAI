import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { RealBiometricAnalyzer } from './realBiometricAnalyzer';
import { prefetchFaceParsingModel } from '@/shared/ai/faceParsingModel';
import { DiagnosticResult } from '@/entities/diagnostic/model/types';
import { diagnosticFromBackend } from '@/entities/diagnostic/model/fromBackend';
import { calculateAuraScore } from '@/entities/aura-score/model/calculator';
import { AuraScoreData } from '@/entities/aura-score/model/types';
import { MediaVaultService } from '@/entities/media-vault/model/mediaVaultService';
import { hapticFeedback } from '@/shared/lib/haptics';
import { getUserProfile } from '@/entities/user/model/storage';
import { diagnosisApi, consentApi, waitForTask } from '@/features/bellai/api/bellaiApi';
import { notifyIfAway } from '@/features/notifications';
import type { IntegratedDiagnosis } from '@/features/bellai/api/types';
import { FriendlyError, friendlyMessage } from '@/shared/api/http';
import { usePhotoAnalysisConsentGate } from '@/features/privacy/model/usePhotoAnalysisConsentGate';
import { bellaiService } from '@/features/bellai/api/bellaiService';

/**
 * Resultado de la última captura, para las pantallas A5 a A7 del flujo de análisis
 * (Penpot «Flujo 02 · Análisis (P1)»). Reemplaza a los `Alert.alert` del análisis.
 */
export type AnalysisOutcome =
  | { kind: 'success'; mode: 'face' | 'body'; offline?: boolean; message?: string }
  | { kind: 'photo'; mode: 'face' | 'body'; message: string }
  | { kind: 'error'; mode: 'face' | 'body'; message: string }
  | { kind: 'permission'; message: string };

type CacheEntry = { diagnostic: DiagnosticResult; score: AuraScoreData; integrated: IntegratedDiagnosis | null; source: 'servidor' | 'local' };

/**
 * Caché en memoria compartida entre pestañas: abrir "Mi análisis" ya no repite el análisis
 * (antes se re-analizaba la última foto en cada foco).
 */
let cache: CacheEntry | null = null;
const listeners = new Set<(c: CacheEntry | null) => void>();
const publish = (entry: CacheEntry | null) => {
  cache = entry;
  listeners.forEach((l) => l(entry));
};

async function withScore(diagnostic: DiagnosticResult) {
  const profile = await getUserProfile();
  return calculateAuraScore(diagnostic, profile);
}

/**
 * El servidor pide la autorización aunque la usuaria ya la dio en la pantalla de permiso (CU08):
 * el análisis solo empieza dentro de `withConsent`. Se sincroniza esa autorización con el servidor
 * en lugar de volver a preguntar con un aviso nativo (que en web no se mostraba y dejaba el análisis
 * detenido). Si no se puede registrar, el análisis termina con el error explicado (pantalla A7).
 */
async function askPhotoConsent(): Promise<boolean> {
  try {
    await consentApi.set('photo_analysis', true);
    return true;
  } catch {
    return false;
  }
}

export const useScanWorkflow = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [entry, setEntry] = useState<CacheEntry | null>(cache);
  const [isRestoring, setIsRestoring] = useState(!cache);
  // HU-06 (equipo) / HU-029: autorización previa con la vista CU08 (incorporado desde main)
  const consentGate = usePhotoAnalysisConsentGate();

  // Descarga en segundo plano el modelo de face parsing (una sola vez) para el análisis sin conexión
  useEffect(() => {
    prefetchFaceParsingModel().catch(() => undefined);
  }, []);
  const [restoreError, setRestoreError] = useState('');
  const [outcome, setOutcome] = useState<AnalysisOutcome | null>(null);
  const version = useRef(0);

  useEffect(() => {
    const l = (c: CacheEntry | null) => setEntry(c);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  /** Recupera el último diagnóstico: primero del servidor; sin conexión, analiza la última foto local. */
  const reloadDiagnostic = useCallback(async (force = false) => {
    if (cache && !force) {
      setIsRestoring(false);
      return;
    }
    const v = ++version.current;
    setIsRestoring(true);
    setRestoreError('');
    try {
      const remote = await diagnosisApi.latest();
      if (v !== version.current) return;
      if (remote) {
        const vault = await MediaVaultService.getItemsByFolder('rostro').catch(() => []);
        const diagnostic = diagnosticFromBackend(remote, vault[0]?.localUri ?? '');
        publish({ diagnostic, score: await withScore(diagnostic), integrated: remote, source: 'servidor' });
      } else {
        publish(null);
      }
    } catch (err: any) {
      // Sin conexión (HU-040): se usa el análisis local de la última foto guardada en el teléfono
      try {
        const items = await MediaVaultService.getItemsByFolder('rostro');
        if (items[0]?.localUri) {
          const diagnostic = await RealBiometricAnalyzer.analyzeFace(items[0].localUri);
          diagnostic.imageUri = items[0].localUri;
          if (v === version.current) publish({ diagnostic, score: await withScore(diagnostic), integrated: null, source: 'local' });
        } else if (v === version.current) {
          setRestoreError(friendlyMessage(err, 'No pudimos recuperar tu análisis.'));
        }
      } catch (restoreErr) {
        // Del Líder («fix models»): la foto guardada estaba dañada. Se borra ese registro para no
        // dejar a la usuaria atrapada en el error, y se muestra el inicio como primera visita.
        console.warn('[useScanWorkflow] No se pudo restaurar la foto previa:', restoreErr);
        try {
          const items = await MediaVaultService.getItemsByFolder('rostro');
          if (items[0]?.id) await MediaVaultService.deleteItem(items[0].id);
        } catch (cleanupErr) {
          console.warn('[useScanWorkflow] No se pudo limpiar el registro dañado:', cleanupErr);
        }
        if (v === version.current) {
          publish(null);
          setRestoreError('');
        }
      }
    } finally {
      if (v === version.current) setIsRestoring(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void reloadDiagnostic(false);
  }, [reloadDiagnostic]));

  /** Envía la foto al diagnóstico del servidor (validación + análisis asíncrono). */
  const runRemote = async (photos: { faceUri?: string; bodyUri?: string }): Promise<CacheEntry> => {
    const start = async () => {
      const task = await diagnosisApi.start(photos);
      const done = await waitForTask<IntegratedDiagnosis>(task, setScanProgress);
      // Si salió de la app mientras se analizaba y este teléfono no recibe push, aviso local
      const season = done.result?.season;
      void notifyIfAway(done.status === 'fallida' || !done.result
        ? { title: 'No pudimos terminar tu análisis', body: done.error || 'Vuelve a intentarlo con otra foto.', url: '/studio', kind: 'analisis_fallido' }
        : { title: 'Tu diagnóstico está listo', body: season ? `Eres ${season}. Mira tu paleta y lo que mejor te queda.` : 'Mira tu paleta y lo que mejor te queda.', url: '/studio', kind: 'analisis_listo' });
      if (done.status === 'fallida' || !done.result) throw new FriendlyError(done.error || 'No pudimos completar el análisis.', { code: 'tarea_fallida' });
      return done.result;
    };
    let result: IntegratedDiagnosis;
    try {
      result = await start();
    } catch (err) {
      if (err instanceof FriendlyError && err.code === 'consentimiento_requerido' && (await askPhotoConsent())) {
        result = await start();
      } else {
        throw err;
      }
    }
    const diagnostic = diagnosticFromBackend(result, photos.faceUri ?? cache?.diagnostic.imageUri ?? '');
    const next = { diagnostic, score: await withScore(diagnostic), integrated: result, source: 'servidor' as const };
    publish(next);
    return next;
  };

  const analyzeFaceUri = async (uri: string) => {
    version.current += 1;
    setIsRestoring(false);
    setRestoreError('');
    setIsScanning(true);
    setScanProgress(0);
    setOutcome(null);
    hapticFeedback.medium();
    let finalUri = uri;
    try {
      finalUri = (await MediaVaultService.saveScanToVault(uri, 'rostro', 'Escaneo facial', { tags: ['rostro'] })).localUri;
    } catch {
      // Si la bóveda local falla se usa la URI temporal
    }
    try {
      const next = await runRemote({ faceUri: finalUri });
      hapticFeedback.success();
      setOutcome({ kind: 'success', mode: 'face' });
      return { diagnostic: next.diagnostic, score: next.score };
    } catch (err) {
      if (err instanceof FriendlyError && !err.isNetwork) {
        // Foto inválida (HU-035) o análisis fallido: se explica qué corregir
        hapticFeedback.warning();
        setOutcome({ kind: 'photo', mode: 'face', message: err.message });
        return null;
      }
      // Sin conexión: análisis local en el teléfono como respaldo
      try {
        const diagnostic = await RealBiometricAnalyzer.analyzeFace(finalUri);
        diagnostic.imageUri = finalUri;
        const next = { diagnostic, score: await withScore(diagnostic), integrated: null, source: 'local' as const };
        publish(next);
        setOutcome({ kind: 'success', mode: 'face', offline: true, message: 'Hicimos un análisis básico en tu teléfono. Cuando tengas conexión, repítelo para obtener el diagnóstico completo.' });
        return { diagnostic: next.diagnostic, score: next.score };
      } catch {
        hapticFeedback.warning();
        setOutcome({ kind: 'error', mode: 'face', message: friendlyMessage(err, 'Intenta con mejor iluminación.') });
        return null;
      }
    } finally {
      setIsScanning(false);
    }
  };

  /** HU-003: análisis corporal; se integra con el último diagnóstico facial. */
  /** Ejecuta el análisis solo con autorización; sin conexión para verificarla, no se analiza. */
  const withConsent = async <T,>(task: () => Promise<T>): Promise<T | null> => {
    let out: T | null = null;
    try {
      await consentGate.runWithConsent(async () => {
        out = await task();
      });
      return out;
    } catch {
      setOutcome({ kind: 'error', mode: 'face', message: 'No pudimos verificar tu autorización. Revisa tu conexión e inténtalo de nuevo; la foto no se analizó.' });
      return null;
    }
  };

  const processImageUri = (uri: string) => withConsent(() => analyzeFaceUri(uri));

  const processBodyUri = (uri: string) => withConsent(() => analyzeBodyUri(uri));

  const analyzeBodyUri = async (uri: string) => {
    setIsScanning(true);
    setScanProgress(0);
    setOutcome(null);
    try {
      await MediaVaultService.saveScanToVault(uri, 'cuerpo', 'Registro de silueta', { tags: ['cuerpo'] }).catch(() => undefined);
      const next = await runRemote({ bodyUri: uri });
      hapticFeedback.success();
      const body = next.integrated?.body;
      const warnings: string[] = Array.isArray(body?.warnings) ? body.warnings : [];
      setOutcome({ kind: 'success', mode: 'body', message: [body?.description ?? 'Tu análisis corporal está listo en «Mi análisis».', ...warnings].join('\n\n') });
      return next;
    } catch (err) {
      if (err instanceof FriendlyError && !err.isNetwork) {
        hapticFeedback.warning();
        setOutcome({ kind: 'photo', mode: 'body', message: err.message });
        return null;
      }
      // Del Líder («fix models»): sin conexión, la silueta se calcula en el teléfono.
      try {
        const diagnostic = await RealBiometricAnalyzer.analyzeBody(uri, cache?.diagnostic ?? null);
        const next = { diagnostic, score: await withScore(diagnostic), integrated: null, source: 'local' as const };
        publish(next);
        void bellaiService.saveDiagnostic(diagnostic).catch(() => undefined);
        hapticFeedback.success();
        setOutcome({ kind: 'success', mode: 'body', offline: true, message: 'Calculamos tu silueta en el teléfono. Cuando tengas conexión, repítela para el análisis completo.' });
        return next;
      } catch {
        hapticFeedback.warning();
        setOutcome({ kind: 'photo', mode: 'body', message: friendlyMessage(err, 'No pudimos analizar tu silueta.') });
        return null;
      }
    } finally {
      setIsScanning(false);
    }
  };

  /** Del Líder («fix models»): carga un análisis de ejemplo para conocer la app sin tomar una foto. */
  const loadSampleDiagnostic = async () => {
    setIsScanning(true);
    hapticFeedback.medium();
    try {
      const sampleDiag: DiagnosticResult = {
        id: `diag-sample-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        imageUri: '',
        skinTone: 'Intermedio / Trigueño Cálido (Medium / Warm Olive)',
        undertone: 'Calido',
        season: 'Otono Calido (True Autumn)',
        faceShape: 'Ovalado',
        bodyType: 'Reloj de Arena (Hourglass)',
        contrastLevel: 'Medio',
        facialSymmetry: 96,
        palette: [
          { hex: '#C2410C', name: 'Terracota Profundo', category: 'acento' },
          { hex: '#D97706', name: 'Mostaza Dorado', category: 'acento' },
          { hex: '#4D7C0F', name: 'Verde Oliva Imperial', category: 'base' },
          { hex: '#B45309', name: 'Caramelo Cálido', category: 'base' },
          { hex: '#FEF3C7', name: 'Marfil Dorado', category: 'neutro' },
          { hex: '#0E7490', name: 'Azul Petróleo Cálido', category: 'acento' },
          { hex: '#78350F', name: 'Chocolate Especiado', category: 'neutro' },
          { hex: '#A16207', name: 'Ámbar Otoñal', category: 'acento' },
        ],
        toxicColors: [
          { hex: '#93C5FD', name: 'Azul Hielo Frío', negativeEffect: 'Proyecta sombras azuladas bajo el mentón y resalta ojeras.' },
          { hex: '#F43F5E', name: 'Fucsia Neón Frío', negativeEffect: 'Compite con el caroteno y genera una apariencia apagada o cetrina.' },
          { hex: '#94A3B8', name: 'Gris Cenizo Pálido', negativeEffect: 'Resta luminosidad y calidez al rostro.' },
        ],
        recommendedMetals: ['Oro', 'Oro Rosa'],
        munsell: {
          temperatureScore: 78,
          valueScore: 64,
          chromaScore: 76,
          dominantDimension: 'Temperatura',
        },
        contrastMetric: {
          deltaL: 34,
          level: 'Contraste Medio',
          stylingRule: 'Equilibrio versátil: combina una base neutra cálida con acentos intencionales de tu paleta.',
        },
        realLandmarks: {
          trichion: [160, 50],
          glabella: [160, 95],
          subnasale: [160, 150],
          menton: [160, 210],
          cheekLeft: [90, 130],
          cheekRight: [230, 130],
          jawLeft: [100, 175],
          jawRight: [220, 175],
          jawlineContour: [
            [100, 175],
            [130, 200],
            [160, 210],
            [190, 200],
            [220, 175],
          ],
        },
        biometricMetrics: {
          faceLengthPx: 188,
          cheekboneWidthPx: 142,
          jawWidthPx: 108,
          lengthToWidthRatio: 1.32,
          chroma: 28.5,
          deltaL: 65,
          lab: { L: 72, a: 3.2, b: -4.1 },
        },
        hairAdvice: {
          recommendedCuts: ['Bob estructurado a la mandíbula', 'Capas largas con volumen en corona', 'Corte mariposa definido'],
          recommendedShades: ['Castaño Cenizo Oscuro', 'Negro Azabache Azulado', 'Borgoña Frío'],
          avoidShades: ['Rubio Dorado Amarillento', 'Cobrizo Cálido', 'Caramelo Naranja'],
        },
        glassesAdvice: {
          recommendedFrames: ['Cat-Eye estructurado', 'Wayfarer geométrico fino', 'Montura hexagonal metálica'],
          avoidFrames: ['Monturas redondas pequeñas', 'Monturas marrones mate'],
        },
      };

      const next = { diagnostic: sampleDiag, score: await withScore(sampleDiag), integrated: null, source: 'local' as const };
      publish(next);
      setRestoreError('');
      void bellaiService.saveDiagnostic(sampleDiag).catch(() => undefined);
      hapticFeedback.success();
      return { diagnostic: sampleDiag, score: next.score };
    } finally {
      setIsScanning(false);
    }
  };

  const pick = async (fromCamera: boolean) => {
    const permission = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setOutcome({ kind: 'permission', message: fromCamera ? 'BellAI necesita acceso a la cámara para tomar la foto.' : 'BellAI necesita acceso a tus fotos para elegir la imagen.' });
      return null;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 };
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]?.uri) return processImageUri(result.assets[0].uri);
    return null;
  };

  return {
    isScanning,
    scanProgress,
    isRestoring,
    restoreError,
    reloadDiagnostic: () => reloadDiagnostic(true),
    clearRestoreError: () => setRestoreError(''),
    loadSampleDiagnostic,
    currentDiagnostic: entry?.diagnostic ?? null,
    currentScore: entry?.score ?? null,
    integratedDiagnosis: entry?.integrated ?? null,
    diagnosisSource: entry?.source ?? null,
    analysisOutcome: outcome,
    clearAnalysisOutcome: () => setOutcome(null),
    takePhotoWithCamera: () => pick(true),
    pickFromGallery: () => pick(false),
    processImageUri,
    processBodyUri,
    photoConsentVisible: consentGate.visible,
    photoConsentSubmitting: consentGate.submitting,
    photoConsentError: consentGate.error,
    grantPhotoConsent: consentGate.grantConsent,
    denyPhotoConsent: consentGate.denyConsent,
  };
};
