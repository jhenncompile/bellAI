import AsyncStorage from '@react-native-async-storage/async-storage';
import { Garment } from '@/entities/wardrobe/model/types';
import { MediaVaultService } from '@/entities/media-vault/model/mediaVaultService';
import { Undertone } from '@/entities/diagnostic/model/types';
import { ApiConfig } from '@/shared/api/apiConfig';
import { getAuthToken } from '@/shared/api/apiClient';
import { colorTemperature, hexToRgb, rgbToLab } from '@/shared/lib/garmentColor';
import * as FileSystem from 'expo-file-system/legacy';
import { LocalGarmentAnalyzer } from '../model/localGarmentAnalyzer';
import { privacyService } from '@/features/privacy/api/privacyService';

const WARDROBE_STORAGE_KEY = '@aura_wardrobe_items_v1';

// Armario cápsula inicial de alta calidad adaptado a la colorimetría cálida otoñal
const INITIAL_STARTER_WARDROBE: Garment[] = [
  {
    id: 'g-init-1',
    name: 'Blazer Sastre Terracota Cálido',
    category: 'Superior',
    primaryColorHex: '#C2410C',
    colorName: 'Terracota Cálido',
    seasonMatch: 'Armonia Total',
    compatibilityScore: 98,
    tips: 'Color estelar que armoniza con la melanina y subtono cálido dorado.',
  },
  {
    id: 'g-init-2',
    name: 'Camisa Clásica Popelín Camel',
    category: 'Superior',
    primaryColorHex: '#78350F',
    colorName: 'Café Tostado / Camel',
    seasonMatch: 'Armonia Total',
    compatibilityScore: 95,
    tips: 'Aporta luminosidad saludable y contraste equilibrado en el rostro.',
  },
  {
    id: 'g-init-3',
    name: 'Pantalón Sastre Recto Beige Arena',
    category: 'Inferior',
    primaryColorHex: '#D6C7B2',
    colorName: 'Beige Arena Neutro',
    seasonMatch: 'Armonia Total',
    compatibilityScore: 93,
    tips: 'Base neutra sólida que estiliza la silueta con elegancia atemporal.',
  },
  {
    id: 'g-init-4',
    name: 'Falda Midi Plisada Verde Oliva',
    category: 'Inferior',
    primaryColorHex: '#4D7C0F',
    colorName: 'Verde Oliva Profundo',
    seasonMatch: 'Armonia Total',
    compatibilityScore: 94,
    tips: 'Sintonía cromática análoga que aporta movimiento fluido y sofisticación.',
  },
  {
    id: 'g-init-5',
    name: 'Mocasines de Cuero Pulido Chocolate',
    category: 'Calzado',
    primaryColorHex: '#3F2212',
    colorName: 'Marrón Chocolate Oscuro',
    seasonMatch: 'Armonia Total',
    compatibilityScore: 92,
    tips: 'Calzado neutro cálido para completar outfits versátiles de diario o trabajo.',
  },
];

export const fetchWardrobeItems = async (): Promise<Garment[]> => {
  try {
    const raw = await AsyncStorage.getItem(WARDROBE_STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(INITIAL_STARTER_WARDROBE));
      return INITIAL_STARTER_WARDROBE;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[AURA Wardrobe] Error cargando prendas:', e);
    return INITIAL_STARTER_WARDROBE;
  }
};

export const saveWardrobeItems = async (items: Garment[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('[AURA Wardrobe] Error guardando prendas:', e);
  }
};

export const clearWardrobeItems = async (): Promise<void> => {
  await AsyncStorage.removeItem(WARDROBE_STORAGE_KEY);
};

/**
 * Escanea una prenda física real:
 * 1. La copia a la bóveda física permanente aura_vault/armario/
 * 2. Consulta el motor de visión remota (OpenCV k-means) o utiliza el analizador cromático local en el dispositivo
 * 3. Evalúa la armonía cromática contra el subtono del usuario
 * 4. La persiste en el armario local
 */
export const scanNewGarment = async (
  imageUri: string,
  category: 'Superior' | 'Inferior' | 'Calzado' | 'Abrigo' | 'Accesorio' = 'Superior',
  garmentName?: string,
  userUndertone: Undertone = 'Frio'
): Promise<Garment> => {
  await privacyService.assertPhotoAnalysisConsent();

  // 1. Guardar en bóveda local
  let localSavedUri = imageUri;
  try {
    const vaultItem = await MediaVaultService.saveScanToVault(imageUri, 'armario', garmentName || 'Prenda digitalizada');
    localSavedUri = vaultItem.localUri;
  } catch (e) {
    console.warn('[AURA Wardrobe] Guardado en bóveda fallback:', e);
  }

  let detectedHex: string | null = null;
  let detectedName: string | null = null;
  let detectedTemp: 'frio' | 'calido' | 'neutro' = 'neutro';
  let seasonMatch: 'Armonia Total' | 'Aceptable' | 'No Favorece' = 'Armonia Total';
  let compatibilityScore = 85;
  let tips = 'Prenda versátil alineada con tu armario.';

  const aiMode = ApiConfig.getAiMode();
  const isRemoteConfigured = ApiConfig.isRemoteConfigured();

  // 2. Si el modo es 'local' o no hay servidor configurado, procesar 100% on-device
  if (aiMode === 'local' || !isRemoteConfigured) {
    console.log('[AURA IA Local] Procesando colorimetría y armonía de prenda on-device...');
    const localResult = await LocalGarmentAnalyzer.analyzeGarment(imageUri, userUndertone);
    detectedHex = localResult.hexColor;
    detectedName = localResult.colorName;
    detectedTemp = localResult.temperature;
    seasonMatch = localResult.seasonMatch;
    compatibilityScore = localResult.compatibilityScore;
    tips = localResult.tips;
  } else {
    // 3. Si es 'remote' o 'auto', intentar el endpoint configurado
    const remoteUrl = ApiConfig.getGarmentEndpoint();
    const token = getAuthToken();
    try {
      console.log(`[AURA Wardrobe] Consultando motor OpenCV en: ${remoteUrl}`);
      const uploadResult = await FileSystem.uploadAsync(remoteUrl, imageUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        // La ruta exige sesión: sin el token respondía 401 y siempre se usaba el análisis local
        headers: token ? { Accept: 'application/json', Authorization: `Bearer ${token}` } : { Accept: 'application/json' },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        // Respuesta de /api/vision/analyze-garment: color con luz corregida, nombrado con
        // CIEDE2000 + CLIP. (Antes se esperaba { success, hexColor }, que la API ya no devuelve.)
        const data = JSON.parse(uploadResult.body);
        if (typeof data.color_hex === 'string') {
          detectedHex = data.color_hex;
          detectedName = data.color || `Tono ${data.color_hex}`;
          detectedTemp = colorTemperature(rgbToLab(hexToRgb(data.color_hex)));
          console.log('[AURA Wardrobe] Color de la prenda según el servidor:', detectedName, detectedHex, detectedTemp);
        }
      }
    } catch (err: any) {
      console.warn(`[AURA Wardrobe] Servidor remoto no disponible (${remoteUrl}):`, err.message);
      console.log('[AURA IA Local] Cambiando automáticamente a analizador cromático on-device...');
    }
  }

  // 4. Si falló el servidor remoto, procesar localmente
  if (!detectedHex) {
    const localResult = await LocalGarmentAnalyzer.analyzeGarment(imageUri, userUndertone);
    detectedHex = localResult.hexColor;
    detectedName = localResult.colorName;
    detectedTemp = localResult.temperature;
    seasonMatch = localResult.seasonMatch;
    compatibilityScore = localResult.compatibilityScore;
    tips = localResult.tips;
  } else if (aiMode !== 'local' && isRemoteConfigured) {
    // Si vino del servidor remoto, evaluar armonía con el subtono del usuario
    if (detectedTemp === 'neutro') {
      seasonMatch = 'Aceptable';
      compatibilityScore = 80;
      tips = 'Tono neutro compatible con la mayoría de prendas base.';
    } else if (detectedTemp === userUndertone.toLowerCase() || userUndertone === 'Neutro') {
      // Igual que el analizador del teléfono: un subtono neutro armoniza con colores fríos y cálidos
      seasonMatch = 'Armonia Total';
      compatibilityScore = 95;
      tips = `Color en perfecta sintonía térmica con tu subtono biológico ${userUndertone}. Aporta luminosidad inmediata.`;
    } else {
      seasonMatch = 'No Favorece';
      compatibilityScore = 48;
      tips = `Temperatura opuesta a tu subtono ${userUndertone}. Te sugerimos usarla en prendas inferiores o compensar con un accesorio cerca del rostro.`;
    }
  }

  const newGarment: Garment = {
    id: `g-${Date.now()}`,
    name: garmentName || `${category} ${detectedName}`,
    category,
    primaryColorHex: detectedHex,
    colorName: detectedName || `Tono ${detectedHex}`,
    seasonMatch,
    compatibilityScore,
    imageUri: localSavedUri,
    tips,
  };

  // 4. Persistir en el armario
  const current = await fetchWardrobeItems();
  const updated = [newGarment, ...current];
  await saveWardrobeItems(updated);

  return newGarment;
};
