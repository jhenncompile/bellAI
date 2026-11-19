import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { api, ApiError } from '../api/apiClient';
import { getAuthToken } from '@/shared/api/apiClient';
import { offlineSyncStorage } from '../storage/offlineSyncStorage';
import { EnvConfig } from '../config/env';
import { getUserSession } from '@/entities/user/model/storage';
import { managedMediaService } from '@/entities/media-vault/model/managedMediaService';
import {
  CATEGORY_LABELS,
  EvaluateStoreGarmentPayload,
  MobileCaptureConfig,
  OCCASION_LABELS,
  SEASON_LABELS,
  StoreGarmentEvaluationResponse,
  SUBCATEGORY_LABELS,
  WardrobeCategory,
  WardrobeHistoryResponse,
  WardrobeItem,
  WardrobeListResponse,
  WardrobeScanPayload,
  WardrobeScanResponse,
  WardrobeOccasion,
  WardrobeSeason,
  WardrobeStatus,
  WardrobeSubcategory,
  WardrobeSyncSnapshot,
  WardrobeSyncStatus,
} from '../types/wardrobe.types';
import { privacyService } from '@/features/privacy/api/privacyService';

export interface WardrobeQueryFilters {
  category?: WardrobeCategory;
  subcategory?: WardrobeSubcategory;
  season?: WardrobeSeason;
  occasion?: WardrobeOccasion;
  status?: WardrobeStatus;
  color?: string;
  search?: string;
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesFilters(item: WardrobeItem, filters?: WardrobeQueryFilters): boolean {
  if (!filters) return true;
  if (filters.category && item.category !== filters.category) return false;
  if (filters.subcategory && item.subcategory !== filters.subcategory) return false;
  const season = (item.bottomDetails.season || '').toLowerCase();
  if (
    filters.season &&
    season !== SEASON_LABELS[filters.season].toLowerCase() &&
    season !== filters.season.toLowerCase()
  ) {
    return false;
  }
  if (filters.occasion && item.bottomDetails.occasion !== filters.occasion) return false;
  if (filters.status && item.status !== filters.status) return false;

  const color = item.bottomDetails.color || '';
  const colorHex = item.bottomDetails.colorHex || '';
  const normalizedColor = normalizeSearchValue(`${color} ${colorHex}`);
  if (
    filters.color &&
    !normalizedColor.includes(normalizeSearchValue(filters.color))
  ) {
    return false;
  }
  if (filters.search) {
    const query = normalizeSearchValue(filters.search);
    const seasonValue = item.bottomDetails.season || '';
    const seasonLabel = SEASON_LABELS[seasonValue as WardrobeSeason] || seasonValue;
    const occasion = item.bottomDetails.occasion;
    const statusLabel =
      item.status === 'confirmed'
        ? 'confirmada'
        : item.status === 'upload_failed'
          ? 'foto pendiente'
          : 'borrador';
    const searchable = normalizeSearchValue(
      `${item.name} ${color} ${colorHex} ${item.subcategory} ${SUBCATEGORY_LABELS[item.subcategory]} ${item.category} ${CATEGORY_LABELS[item.category]} ${seasonValue} ${seasonLabel} ${occasion || ''} ${occasion ? OCCASION_LABELS[occasion] : ''} ${item.status} ${statusLabel}`,
    );
    if (!searchable.includes(query)) return false;
  }
  return true;
}

/**
 * Construye un `FormData` compatible con React Native (Android, iOS y Web)
 * para enviar la fotografía capturada desde cámara o galería a `/api/wardrobe/scan`.
 */
async function appendPhotoToFormData(
  formData: FormData,
  photoUri: string,
  fileName = 'prenda_captura.jpg',
  mimeType = 'image/jpeg',
): Promise<void> {
  if (Platform.OS === 'web') {
    const response = await fetch(photoUri);
    const blob = await response.blob();
    formData.append('photo', blob, fileName);
  } else {
    formData.append('photo', {
      uri: photoUri,
      name: fileName,
      type: mimeType,
    } as any);
  }
}

/**
 * Normaliza las fotos del teléfono para que la carga no dependa de HEIC ni del tamaño
 * original de la cámara. El backend admite fotografías de hasta 8 MB.
 */
async function prepareNativePhotoForUpload(photoUri: string): Promise<string> {
  if (Platform.OS === 'web') return photoUri;

  try {
    const result = await manipulateAsync(
      photoUri,
      [{ resize: { width: 1600 } }],
      {
        format: SaveFormat.JPEG,
        compress: 0.78,
      },
    );
    return result.uri;
  } catch {
    // La foto original ya fue leída por el analizador; si falla su compresión,
    // se conserva y se intenta enviar sin volver a bloquear el guardado.
    return photoUri;
  }
}

/**
 * Servicio del Armario Digital Inteligente conectado a todos los endpoints de `/api/wardrobe`
 * (HU-009, HU-011 y HU-040), con respaldo automático sin conexión y conservación de borradores.
 */
export const wardrobeService = {
  /**
   * Al abrir el armario con conexión, procesa los borradores que quedaron
   * pendientes. La foto privada se conserva hasta que el backend entregue su
   * resultado mejorado y este pueda publicarse en la galería.
   */
  async syncPendingDrafts(): Promise<void> {
    const drafts = await offlineSyncStorage.getLocalOfflineDrafts();
    for (const draft of drafts) {
      if (!draft.localPhotoUri) continue;
      try {
        await this.scanAndSaveGarment({
          draftId: draft.id,
          photoUri: draft.localPhotoUri,
          name: draft.name.replace(' (Borrador sin conexión)', ''),
          category: draft.category,
          subcategory: draft.subcategory,
          color: draft.bottomDetails.color,
          approximateSize: draft.bottomDetails.approximateSize,
          occasion: draft.bottomDetails.occasion || undefined,
          captureSource: draft.captureSource,
        });
      } catch (error) {
        console.warn('[wardrobeService] El borrador seguirá pendiente de sincronización:', error);
      }
    }
  },

  /**
   * Obtiene los permisos requeridos de Cámara/Galería y catálogos (`GET /api/wardrobe/mobile-config`).
   */
  async getMobileConfig(): Promise<MobileCaptureConfig> {
    return api.get<MobileCaptureConfig>('/wardrobe/mobile-config');
  },

  /**
   * Consulta el armario de la usuaria con filtros (`GET /api/wardrobe`, HU-011).
   * Si no hay conexión y el modo offline está activo, filtra sobre la copia local sincronizada.
   */
  async getWardrobe(
    filters?: WardrobeQueryFilters,
  ): Promise<{ data: WardrobeListResponse; fromOfflineCache: boolean }> {
    try {
      const response = await api.get<WardrobeListResponse>('/wardrobe', {
        params: {
          category: filters?.category,
          subcategory: filters?.subcategory,
          season: filters?.season,
          occasion: filters?.occasion,
          status: filters?.status,
          color: filters?.color,
          // La búsqueda se aplica sobre el inventario descargado para incluir temporada,
          // ocasión, estado y etiquetas traducidas sin depender de la collation del servidor.
          search: undefined,
        },
      });

      const pendingDraftsBeforeSync = await offlineSyncStorage.getLocalOfflineDrafts();
      await this.syncPendingDrafts();
      const localDrafts = await offlineSyncStorage.getLocalOfflineDrafts();
      if (localDrafts.length < pendingDraftsBeforeSync.length) {
        // El listado remoto se leyó antes de sincronizar. Una sola recarga evita
        // que la prenda recién confirmada desaparezca hasta el siguiente refresh.
        return this.getWardrobe(filters);
      }

      // Combinar borradores locales creados sin red si existen
      const mergedItems = [
        ...localDrafts.filter(
          (draft) =>
            matchesFilters(draft, filters) &&
            !response.items.some((remote: WardrobeItem) => remote.id === draft.id),
        ),
        ...response.items.filter((item: WardrobeItem) => matchesFilters(item, filters)),
      ];

      return {
        data: {
          ...response,
          isEmpty: response.isEmpty && localDrafts.length === 0,
          items: mergedItems,
        },
        fromOfflineCache: false,
      };
    } catch (error) {
      const snapshot = await offlineSyncStorage.getSyncSnapshot();
      const localDrafts = await offlineSyncStorage.getLocalOfflineDrafts();

      if (snapshot && snapshot.syncStatus.offlineModeEnabled) {
        const allItems = [
          ...localDrafts,
          ...(snapshot.wardrobe?.items || []).filter(
            (i: WardrobeItem) => !localDrafts.some((d) => d.id === i.id),
          ),
        ];

        const filtered = allItems.filter((item) => matchesFilters(item, filters));

        return {
          data: {
            ...snapshot.wardrobe,
            isEmpty: allItems.length === 0,
            items: filtered,
          },
          fromOfflineCache: true,
        };
      }

      throw error;
    }
  },

  /**
   * Escanea y guarda una prenda desde la cámara o galería (`POST /api/wardrobe/scan`, HU-009).
   * Si falla la subida de la foto por red caída, conserva automáticamente el borrador en el dispositivo.
   */
  async scanAndSaveGarment(payload: WardrobeScanPayload): Promise<WardrobeScanResponse> {
    if (payload.photoUri) {
      await privacyService.assertPhotoAnalysisConsent();
    }

    const formData = new FormData();
    const session = await getUserSession();
    let captureId: string | null = null;
    let photoUri = payload.photoUri;

    // La URI entregada por la cámara o el selector puede ser temporal. Se copia antes
    // de cualquier carga para que un borrador sin conexión sobreviva al reinicio.
    if (photoUri && session?.user?.id && Platform.OS !== 'web') {
      try {
        const capture = await managedMediaService.preserveCapture(photoUri, session.user.id);
        captureId = capture.id;
        photoUri = capture.localUri;
      } catch (error) {
        console.warn('[wardrobeService] No se pudo preservar la captura local:', error);
      }
    }

    if (photoUri) {
      const uploadUri = await prepareNativePhotoForUpload(photoUri);
      await appendPhotoToFormData(
        formData,
        uploadUri,
        `prenda_${Date.now()}.jpg`,
        'image/jpeg',
      );
    }

    if (payload.name) formData.append('name', payload.name.trim());
    if (payload.category) formData.append('category', payload.category);
    if (payload.subcategory) formData.append('subcategory', payload.subcategory);
    if (payload.color) formData.append('color', payload.color.trim());
    if (payload.colorHex) formData.append('colorHex', payload.colorHex);
    if (payload.approximateSize) {
      formData.append('approximateSize', payload.approximateSize.trim());
    }
    if (payload.season) formData.append('season', payload.season);
    if (payload.occasion) formData.append('occasion', payload.occasion);
    formData.append('captureSource', payload.captureSource);
    formData.append('autoConfirm', 'true');
    // Los borradores solo locales no existen en el backend y sus IDs no son UUIDs.
    if (payload.draftId && !payload.draftId.startsWith('local-draft-')) {
      formData.append('draftId', payload.draftId);
    }

    try {
      let result: WardrobeScanResponse;

      if (Platform.OS !== 'web' && photoUri) {
        const uploadUri = await prepareNativePhotoForUpload(photoUri);
        const scanUrl = `${EnvConfig.getApiBaseUrl()}/wardrobe/scan`;
        const authToken = getAuthToken() || session?.token || null;

        const uploadParameters: Record<string, string> = {
          captureSource: payload.captureSource,
          autoConfirm: 'true',
        };
        if (payload.name) uploadParameters.name = payload.name.trim();
        if (payload.category) uploadParameters.category = payload.category;
        if (payload.subcategory) uploadParameters.subcategory = payload.subcategory;
        if (payload.color) uploadParameters.color = payload.color.trim();
        if (payload.colorHex) uploadParameters.colorHex = payload.colorHex;
        if (payload.approximateSize) uploadParameters.approximateSize = payload.approximateSize.trim();
        if (payload.season) uploadParameters.season = payload.season;
        if (payload.occasion) uploadParameters.occasion = payload.occasion;
        if (payload.draftId && !payload.draftId.startsWith('local-draft-')) {
          uploadParameters.draftId = payload.draftId;
        }

        console.log(`[AURA Wardrobe] Subiendo prenda a ${scanUrl} con FileSystem.uploadAsync`);
        const uploadResponse = await FileSystem.uploadAsync(scanUrl, uploadUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'photo',
          mimeType: 'image/jpeg',
          headers: {
            Accept: 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          parameters: uploadParameters,
        });

        if (uploadResponse.status >= 200 && uploadResponse.status < 300) {
          result = JSON.parse(uploadResponse.body) as WardrobeScanResponse;
        } else {
          let parsedError: any = null;
          try {
            parsedError = JSON.parse(uploadResponse.body);
          } catch {
            parsedError = uploadResponse.body;
          }
          const errorMessage =
            parsedError?.message ||
            (uploadResponse.status === 401
              ? 'Tu sesión expiró. Inicia sesión nuevamente para guardar tu prenda.'
              : 'El servidor no pudo procesar la fotografía de la prenda.');
          throw new ApiError(errorMessage, {
            statusCode: uploadResponse.status,
            rawData: parsedError,
            isNetworkError: false,
          });
        }
      } else {
        result = await api.post<WardrobeScanResponse>(
          '/wardrobe/scan',
          formData,
          { timeoutMs: 120_000 },
        );
      }

      if (payload.draftId) {
        await offlineSyncStorage.removeLocalOfflineDraft(payload.draftId);
      }

      // Solo el resultado mejorado se publica en la galería. La original queda
      // dentro del espacio privado de BellAI para reintentos y uso sin conexión.
      if (captureId) {
        await managedMediaService.publishEnhancedCapture(
          captureId,
          EnvConfig.resolveImageUrl(result.item.enhancedImageUrl),
          result.item.id,
        );
      }

      await offlineSyncStorage.patchCachedWardrobeItems((items, history) => ({
        items: [result.item, ...items.filter((i) => i.id !== result.item.id)],
        history: [
          {
            id: `hist-${Date.now()}`,
            actionCode: result.savedAsDraft
              ? 'WARDROBE_DRAFT_SAVED'
              : 'WARDROBE_ITEM_SCANNED',
            actionType: 'agregar',
            description: result.savedAsDraft
              ? `Se guardó el borrador "${result.item.name}"`
              : `Se agregó "${result.item.name}" al armario`,
            itemId: result.item.id,
            itemName: result.item.name,
            category: result.item.category,
            subcategory: result.item.subcategory,
            occurredAt: new Date().toISOString(),
          },
          ...history,
        ],
      }));

      return result;
    } catch (error) {
      // Regla de negocio HU-009: "Si falla la subida de la foto, se conserva el borrador"
      const authenticationFailed =
        error instanceof ApiError && error.statusCode === 401;
      const consentDenied =
        error instanceof ApiError &&
        error.statusCode === 403 &&
        typeof error.rawData === 'object' &&
        error.rawData !== null &&
        (error.rawData as { error?: string }).error ===
          'PHOTO_ANALYSIS_CONSENT_REQUIRED';
      if (consentDenied) throw error;
      if (error instanceof ApiError && (error.isNetworkError || authenticationFailed)) {
        const fallbackCategory: WardrobeCategory = payload.category || 'superior';
        const fallbackSubcategory: WardrobeSubcategory = payload.subcategory || 'blusas';
        const nowIso = new Date().toISOString();

        const localDraft: WardrobeItem = {
          id: payload.draftId || `local-draft-${Date.now()}`,
          userId: 'local-user',
          name:
            payload.name?.trim() ||
            `${SUBCATEGORY_LABELS[fallbackSubcategory]} (Borrador sin conexión)`,
          category: fallbackCategory,
          subcategory: fallbackSubcategory,
          status: 'upload_failed',
          captureSource: payload.captureSource,
          originalImageUrl: photoUri || null,
          enhancedImageUrl: null,
          localPhotoUri: photoUri || null,
          bottomDetails: {
            color: payload.color || 'Pendiente de análisis',
            colorHex: payload.colorHex || '',
            approximateSize: payload.approximateSize || 'M (Aprox.)',
            season: payload.season ? (SEASON_LABELS[payload.season as WardrobeSeason] || 'Todo el año') : 'Todo el año',
            occasion: payload.occasion || null,
            categoryLabel: `${CATEGORY_LABELS[fallbackCategory]} • ${SUBCATEGORY_LABELS[fallbackSubcategory]}`,
          },
          usageStats: {
            addedAt: nowIso,
            updatedAt: nowIso,
            lastWornAt: null,
            wearCount: 0,
          },
          actions: {
            canWear: false,
            canEdit: true,
            canDelete: true,
          },
          aiMetadata: { savedOfflineDraft: true },
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await offlineSyncStorage.saveLocalOfflineDraft(localDraft);

        return {
          savedAsDraft: true,
          message: authenticationFailed
            ? 'La sesión no está autorizada para sincronizar. Guardamos la prenda y su foto en este dispositivo para que no las pierdas.'
          : 'No pudimos conectar con el servidor. La prenda quedó guardada como borrador en este dispositivo; vuelve al armario para verla y reintentar la sincronización.',
          item: localDraft,
        };
      }

      throw error;
    }
  },

  /**
   * Reintenta subir la fotografía de un borrador (`PATCH /api/wardrobe/:id/photo`, HU-009).
   */
  async retryDraftPhotoUpload(
    item: WardrobeItem,
    photoUri: string,
    captureSource: 'camera' | 'gallery' = 'gallery',
  ): Promise<WardrobeScanResponse> {
    await privacyService.assertPhotoAnalysisConsent();

    if (item.id.startsWith('local-draft-')) {
      return this.scanAndSaveGarment({
        draftId: item.id,
        photoUri,
        name: item.name.replace(' (Borrador sin conexión)', ''),
        category: item.category,
        subcategory: item.subcategory,
        color: item.bottomDetails.color,
        approximateSize: item.bottomDetails.approximateSize,
        occasion: item.bottomDetails.occasion || undefined,
        captureSource,
      });
    }

    const formData = new FormData();
    const session = await getUserSession();
    let captureId: string | null = null;
    let persistedPhotoUri = photoUri;
    if (session?.user?.id && Platform.OS !== 'web') {
      try {
        const capture = await managedMediaService.preserveCapture(photoUri, session.user.id);
        captureId = capture.id;
        persistedPhotoUri = capture.localUri;
      } catch (error) {
        console.warn('[wardrobeService] No se pudo preservar el reintento local:', error);
      }
    }
    let result: WardrobeScanResponse;

    if (Platform.OS !== 'web' && persistedPhotoUri) {
      const uploadUri = await prepareNativePhotoForUpload(persistedPhotoUri);
      const photoUrl = `${EnvConfig.getApiBaseUrl()}/wardrobe/${item.id}/photo`;
      const authToken = getAuthToken() || session?.token || null;

      const uploadResponse = await FileSystem.uploadAsync(photoUrl, uploadUri, {
        httpMethod: 'PATCH',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'photo',
        mimeType: 'image/jpeg',
        headers: {
          Accept: 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        parameters: {
          captureSource,
        },
      });

      if (uploadResponse.status >= 200 && uploadResponse.status < 300) {
        result = JSON.parse(uploadResponse.body) as WardrobeScanResponse;
      } else {
        let parsedError: any = null;
        try {
          parsedError = JSON.parse(uploadResponse.body);
        } catch {
          parsedError = uploadResponse.body;
        }
        throw new ApiError(parsedError?.message || 'Error al reintentar la subida de fotografía.', {
          statusCode: uploadResponse.status,
          rawData: parsedError,
          isNetworkError: false,
        });
      }
    } else {
      const uploadUri = await prepareNativePhotoForUpload(persistedPhotoUri);
      await appendPhotoToFormData(
        formData,
        uploadUri,
        `reintento_${item.id}.jpg`,
        'image/jpeg',
      );
      formData.append('captureSource', captureSource);

      result = await api.patch<WardrobeScanResponse>(
        `/wardrobe/${item.id}/photo`,
        formData,
        { timeoutMs: 120_000 },
      );
    }

    if (captureId) {
      await managedMediaService.publishEnhancedCapture(
        captureId,
        EnvConfig.resolveImageUrl(result.item.enhancedImageUrl),
        result.item.id,
      );
    }

    await offlineSyncStorage.patchCachedWardrobeItems((items) => ({
      items: items.map((i) => (i.id === result.item.id ? result.item : i)),
    }));

    return result;
  },

  /**
   * Obtiene el detalle completo de una prenda (`GET /api/wardrobe/:id`, HU-011).
   */
  async getGarmentById(itemId: string): Promise<WardrobeItem> {
    if (itemId.startsWith('local-draft-')) {
      const drafts = await offlineSyncStorage.getLocalOfflineDrafts();
      const found = drafts.find((d) => d.id === itemId);
      if (found) return found;
    }
    return api.get<WardrobeItem>(`/wardrobe/${itemId}`);
  },

  /**
   * Edita los atributos de una prenda o confirma un borrador (`PATCH /api/wardrobe/:id`, HU-009 y HU-011).
   */
  async updateGarment(
    itemId: string,
    updates: {
      name?: string;
      category?: WardrobeCategory;
      subcategory?: WardrobeSubcategory;
      color?: string;
      approximateSize?: string;
      season?: WardrobeSeason;
      occasion?: WardrobeOccasion | null;
      confirmDraft?: boolean;
    },
  ): Promise<{ message: string; item: WardrobeItem }> {
    const response = await api.patch<{ message: string; item: WardrobeItem }>(
      `/wardrobe/${itemId}`,
      updates,
    );

    await offlineSyncStorage.patchCachedWardrobeItems((items, history) => ({
      items: items.map((i) => (i.id === itemId ? response.item : i)),
      history: [
        {
          id: `hist-${Date.now()}`,
          actionCode: 'WARDROBE_ITEM_UPDATED',
          actionType: 'editar',
          description: `Se editó la prenda "${response.item.name}"`,
          itemId: response.item.id,
          itemName: response.item.name,
          category: response.item.category,
          subcategory: response.item.subcategory,
          occurredAt: new Date().toISOString(),
        },
        ...history,
      ],
    }));

    return response;
  },

  /**
   * Registra que la usuaria usó la prenda hoy (`POST /api/wardrobe/:id/wear`, HU-011).
   */
  async recordGarmentWear(
    itemId: string,
    wornAt?: string,
  ): Promise<{ message: string; item: WardrobeItem }> {
    const response = await api.post<{ message: string; item: WardrobeItem }>(
      `/wardrobe/${itemId}/wear`,
      wornAt ? { wornAt } : {},
    );

    await offlineSyncStorage.patchCachedWardrobeItems((items, history) => ({
      items: items.map((i) => (i.id === itemId ? response.item : i)),
      history: [
        {
          id: `hist-${Date.now()}`,
          actionCode: 'WARDROBE_ITEM_WORN',
          actionType: 'usar',
          description: `Se registró el uso de "${response.item.name}"`,
          itemId: response.item.id,
          itemName: response.item.name,
          category: response.item.category,
          subcategory: response.item.subcategory,
          occurredAt: new Date().toISOString(),
        },
        ...history,
      ],
    }));

    return response;
  },

  /**
   * Elimina una prenda del armario personal (`DELETE /api/wardrobe/:id`, HU-009 y HU-011).
   */
  async deleteGarment(itemId: string, itemName?: string): Promise<{ message: string }> {
    if (itemId.startsWith('local-draft-')) {
      await offlineSyncStorage.removeLocalOfflineDraft(itemId);
      return { message: 'Borrador local eliminado de tu armario.' };
    }

    const response = await api.delete<{ message: string; deletedId: string }>(
      `/wardrobe/${itemId}`,
    );

    await offlineSyncStorage.patchCachedWardrobeItems((items, history) => ({
      items: items.filter((i) => i.id !== itemId),
      history: [
        {
          id: `hist-${Date.now()}`,
          actionCode: 'WARDROBE_ITEM_DELETED',
          actionType: 'eliminar',
          description: `Se eliminó "${itemName || 'prenda'}" del armario`,
          itemId,
          itemName: itemName || null,
          category: null,
          subcategory: null,
          occurredAt: new Date().toISOString(),
        },
        ...history,
      ],
    }));

    return response;
  },

  /**
   * Obtiene el paquete completo de sincronización en la nube y modo sin conexión (`GET /api/wardrobe/sync`, HU-040).
   */
  async fetchSyncSnapshot(): Promise<{
    snapshot: WardrobeSyncSnapshot;
    fromOfflineCache: boolean;
  }> {
    try {
      const snapshot = await api.get<WardrobeSyncSnapshot>('/wardrobe/sync');
      await offlineSyncStorage.saveSyncSnapshot(snapshot);
      return { snapshot, fromOfflineCache: false };
    } catch (error) {
      const cached = await offlineSyncStorage.getSyncSnapshot();
      if (cached) {
        return {
          snapshot: {
            ...cached,
            syncStatus: {
              ...cached.syncStatus,
              cloudAvailable: false,
            },
          },
          fromOfflineCache: true,
        };
      }
      throw error;
    }
  },

  /**
   * Actualiza los interruptores de Copia automática (`autoBackupEnabled`) y Modo sin conexión (`offlineModeEnabled`)
   * (`PATCH /api/wardrobe/sync/settings`, HU-040).
   */
  async updateSyncSettings(settings: {
    autoBackupEnabled?: boolean;
    offlineModeEnabled?: boolean;
  }): Promise<{ message: string; syncStatus: WardrobeSyncStatus }> {
    try {
      const response = await api.patch<{
        message: string;
        syncStatus: WardrobeSyncStatus;
      }>('/wardrobe/sync/settings', settings);

      await offlineSyncStorage.patchCachedWardrobeItems((items, history) => ({
        items,
        history,
        syncStatus: response.syncStatus,
      }));

      return response;
    } catch {
      // Actualizar preferencia también en caché local si no hay red en ese instante
      const cached = await offlineSyncStorage.getSyncSnapshot();
      const fallbackStatus: WardrobeSyncStatus = {
        cloudAvailable: false,
        autoBackupEnabled:
          settings.autoBackupEnabled ?? cached?.syncStatus.autoBackupEnabled ?? true,
        offlineModeEnabled:
          settings.offlineModeEnabled ?? cached?.syncStatus.offlineModeEnabled ?? true,
        lastSyncedAt: cached?.syncStatus.lastSyncedAt ?? new Date().toISOString(),
      };

      if (cached) {
        await offlineSyncStorage.saveSyncSnapshot({
          ...cached,
          syncStatus: fallbackStatus,
        });
      }

      return {
        message: 'Preferencias guardadas localmente en modo sin conexión.',
        syncStatus: fallbackStatus,
      };
    }
  },

  /**
   * Consulta el historial de acciones del armario (`GET /api/wardrobe/history`, HU-040).
   */
  async getHistory(limit = 30): Promise<WardrobeHistoryResponse> {
    try {
      return await api.get<WardrobeHistoryResponse>('/wardrobe/history', {
        params: { limit },
      });
    } catch (error) {
      const cached = await offlineSyncStorage.getSyncSnapshot();
      if (cached) {
        return {
          total: cached.history.length,
          history: cached.history.slice(0, limit),
        };
      }
      throw error;
    }
  },

  /**
   * HU-24: Evalúa si una prenda que la usuaria está viendo en una tienda física o digital
   * es compatible con su perfil (colorimetría y subtono) y con las prendas reales de su armario,
   * para evitar compras impulsivas que luego no utilice.
   */
  async evaluateStoreGarment(
    payload: EvaluateStoreGarmentPayload,
    photoUri?: string,
  ): Promise<StoreGarmentEvaluationResponse> {
    try {
      let body: any = payload;
      let headers: Record<string, string> | undefined;

      if (photoUri) {
        const formData = new FormData();
        await appendPhotoToFormData(formData, photoUri, 'tienda_prenda.jpg', 'image/jpeg');
        if (payload.name) formData.append('name', payload.name);
        formData.append('category', payload.category);
        if (payload.subcategory) formData.append('subcategory', payload.subcategory);
        if (payload.color) formData.append('color', payload.color);
        if (payload.colorHex) formData.append('colorHex', payload.colorHex);
        if (payload.occasion) formData.append('occasion', payload.occasion);
        if (payload.season) formData.append('season', payload.season);
        if (payload.storeName) formData.append('storeName', payload.storeName);
        if (payload.price !== undefined) formData.append('price', String(payload.price));

        body = formData;
        if (Platform.OS === 'web') {
          headers = { 'Content-Type': 'multipart/form-data' };
        }
      }

      return await api.post<StoreGarmentEvaluationResponse>(
        '/wardrobe/evaluate-purchase',
        body,
        { headers },
      );
    } catch {
      // Soporte fuera de línea: si la red falla en la tienda, evaluamos con el snapshot local
      const cached = await offlineSyncStorage.getSyncSnapshot();
      const localItems = cached?.wardrobe?.items || [];
      const evaluatedColor = payload.color || 'Neutro';
      const isNeutral = ['negro', 'blanco', 'gris', 'beige', 'denim', 'marino', 'crema'].some(
        (n) => evaluatedColor.toLowerCase().includes(n),
      );

      // Buscar prendas complementarias en la caché local
      const matching = localItems
        .filter((item) => {
          if (payload.category === 'superior') return item.category === 'inferior' || item.category === 'abrigo';
          if (payload.category === 'inferior') return item.category === 'superior' || item.category === 'abrigo';
          return item.category === 'superior' || item.category === 'inferior';
        })
        .slice(0, 3)
        .map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          categoryLabel: CATEGORY_LABELS[item.category] || item.category,
          color: item.bottomDetails.color,
          colorHex: item.bottomDetails.colorHex,
          photoUrl: item.localPhotoUri || item.enhancedImageUrl || item.originalImageUrl,
          matchReason: 'Prenda complementaria guardada en tu armario sin conexión.',
        }));

      const level = matching.length >= 2 ? 'alto' : matching.length === 1 ? 'medio' : 'bajo';

      return {
        compatibilityLevel: level,
        compatibilityScore: level === 'alto' ? 80 : level === 'medio' ? 55 : 30,
        verdictTitle:
          level === 'alto'
            ? 'Compatibilidad Alta (Modo sin conexión)'
            : level === 'medio'
              ? 'Compatibilidad Media (Modo sin conexión)'
              : 'Compatibilidad Baja (Modo sin conexión)',
        summary: `Evaluación estimada con tus datos locales. La prenda combina con ${matching.length} pieza(s) de tu armario. Conéctate a internet para obtener precisión de colorimetría con tu perfil.`,
        colorAnalysis: {
          seasonalHarmony: isNeutral ? 'favorable' : 'neutro',
          userSeason: 'Guardada localmente',
          userUndertone: 'Natural',
          colorEvaluated: evaluatedColor,
          description: `El tono "${evaluatedColor}" fue evaluado localmente con los neutros disponibles en tu armario sin conexión.`,
        },
        wardrobeAnalysis: {
          matchingCount: matching.length,
          description: `Identificamos ${matching.length} prendas guardadas en la memoria local con las que puedes crear combinaciones.`,
        },
        matchingWardrobeItems: matching,
        recommendationTips: [
          'Guarda o anota la prenda para revisarla cuando tengas conexión completa.',
          matching.length > 0
            ? 'Tienes prendas locales que pueden armar un conjunto con esta pieza.'
            : 'No detectamos prendas complementarias en tu almacenamiento local.',
        ],
      };
    }
  },
};
