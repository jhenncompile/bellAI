import { apiClient } from '@/shared/api/apiClient';
import { uploadMultipart } from '@/shared/api/http';
import type {
  AvatarConfig, AvatarGarment, AvatarScanMesh, AvatarScanSummary, ChatMessageView, CompareResponse, CompatibilityResult, FeedbackValue,
  GenerateOutfitsResponse, HistoryEntry, IntegratedDiagnosis, PhotoValidation, RecommendationsResponse,
  OutfitRating, SavedOutfit, SimulationKind, SimulationOptions, SimulationResult, StyleDna, TaskView,
} from './types';

export interface OutfitContextInput {
  occasion?: string;
  latitude?: number;
  longitude?: number;
  temperatureC?: number;
  rainy?: boolean;
}

/** HU-041: tareas asíncronas de IA. */
export const tasksApi = {
  get: async <R = any>(id: string) => (await apiClient.get<TaskView<R>>(`/tasks/${id}`)).data,
  retry: async <R = any>(id: string) => (await apiClient.post<TaskView<R>>(`/tasks/${id}/retry`)).data,
};

/** HU-002 a HU-006, HU-035, HU-036. */
export const diagnosisApi = {
  validate: (uri: string, type: 'rostro' | 'cuerpo' | 'prenda') =>
    uploadMultipart<PhotoValidation>('/diagnosis/validate', [{ field: 'file', uri }], { type }, 30000),
  start: (photos: { faceUri?: string; bodyUri?: string }) =>
    uploadMultipart<TaskView<IntegratedDiagnosis>>(
      '/diagnosis',
      [
        ...(photos.faceUri ? [{ field: 'face', uri: photos.faceUri }] : []),
        ...(photos.bodyUri ? [{ field: 'body', uri: photos.bodyUri }] : []),
      ],
      {},
      90000,
    ),
  latest: async () => (await apiClient.get<IntegratedDiagnosis | null>('/diagnosis/latest')).data,
  list: async () => (await apiClient.get<any[]>('/diagnosis')).data,
  remove: async (id: string) => (await apiClient.delete(`/diagnosis/${id}`)).data,
};

/** HU-007/008, HU-012/013/014, HU-018/039, HU-028. */
export const styleApi = {
  dna: async () => (await apiClient.get<StyleDna>('/style/dna')).data,
  recommendations: async (occasion?: string) =>
    (await apiClient.get<RecommendationsResponse>('/style/recommendations', { params: occasion ? { occasion } : {} })).data,
  feedback: async (input: { targetType: string; targetId: string; value: FeedbackValue; attributes?: Record<string, unknown> }) =>
    (await apiClient.post('/style/feedback', input)).data,
  history: async (kind?: string) => (await apiClient.get<HistoryEntry[]>('/style/history', { params: kind ? { kind } : {} })).data,
};

/** HU-015/016/017/018, HU-038. */
export const outfitsApi = {
  generate: async (ctx: OutfitContextInput & { count?: number }) => (await apiClient.post<GenerateOutfitsResponse>('/outfits/generate', ctx, { timeout: 30000 })).data,
  compare: async (ctx: OutfitContextInput & { outfits: { itemIds: string[]; title?: string }[] }) => (await apiClient.post<CompareResponse>('/outfits/compare', ctx)).data,
  save: async (input: { itemIds: string[]; title?: string; occasion?: string; explanation?: string; score?: number; weatherSummary?: string; temperatureC?: number; favorite?: boolean; rating?: OutfitRating }) =>
    (await apiClient.post<SavedOutfit>('/outfits', input)).data,
  /** HU-22: guardadas, opcionalmente solo favoritas o con una valoración */
  list: async (filter: { favorites?: boolean; rating?: OutfitRating } = {}) => (await apiClient.get<SavedOutfit[]>('/outfits', { params: filter })).data,
  update: async (id: string, input: { title?: string; favorite?: boolean; rating?: OutfitRating | null }) => (await apiClient.patch<SavedOutfit>(`/outfits/${id}`, input)).data,
  remove: async (id: string) => (await apiClient.delete(`/outfits/${id}`)).data,
  wear: async (id: string) => (await apiClient.post(`/outfits/${id}/wear`)).data,
};

/** HU-024/025/027. */
export const compatibilityApi = {
  evaluate: (uri: string, ctx: OutfitContextInput & { price?: number }) =>
    uploadMultipart<CompatibilityResult>('/compatibility', [{ field: 'file', uri }], {
      occasion: ctx.occasion, price: ctx.price, latitude: ctx.latitude, longitude: ctx.longitude, temperatureC: ctx.temperatureC,
    }, 60000),
};

/** HU-019/020/021. */
export const simulationsApi = {
  options: async () => (await apiClient.get<SimulationOptions>('/simulations/options')).data,
  start: (uri: string, kind: SimulationKind, options: Record<string, unknown>) =>
    uploadMultipart<TaskView<SimulationResult>>('/simulations', [{ field: 'file', uri }], { kind, options: JSON.stringify(options) }, 60000),
};

/** HU-022/023. */
export const avatarApi = {
  get: async () => (await apiClient.get<AvatarConfig>('/avatar')).data,
  save: async (
    customization: Partial<
      Pick<
        AvatarConfig,
        | 'skinHex'
        | 'hairHex'
        | 'hairLength'
        | 'hairStyle'
        | 'eyeColorHex'
        | 'complexion'
        | 'complexionScale'
        | 'heightScale'
        | 'bustScale'
        | 'waistScale'
        | 'hipsScale'
        | 'shouldersScale'
        | 'preset'
        | 'hairFringe'
      >
    >,
  ) => (await apiClient.post<AvatarConfig>('/avatar', { customization })).data,
  dress: async (outfitId: string) => (await apiClient.get<{ items: AvatarGarment[] }>(`/avatar/outfit/${outfitId}`)).data,
  /** HU-023: sube el escaneo guiado (fotos de la cabeza, pose T y giro) y devuelve la tarea. */
  scan: (photos: { field: string; uri: string }[], heightCm: number) =>
    uploadMultipart<TaskView<AvatarScanSummary>>('/avatar/scan', photos, { height_cm: heightCm }, 180000),
  /** Comprobación rápida del encuadre durante el escaneo (la foto no se guarda). */
  checkBody: (uri: string) =>
    uploadMultipart<{ ok: boolean; code: string | null; message: string; tpose: boolean }>('/avatar/scan/check', [{ field: 'file', uri }], {}, 20000),
  /** `garments`: «tipo:RRGGBB,…» (prendas del outfit). Sin prendas, el maniquí trae la ropa genérica. */
  mesh: async (garments?: string) =>
    (await apiClient.get<AvatarScanMesh>('/avatar/mesh', { timeout: 60000, params: garments ? { garments } : undefined })).data,
  removeScan: async () => (await apiClient.delete<{ deleted: boolean }>('/avatar/scan')).data,
};

/** HU-026/027/042. */
export const assistantApi = {
  status: async () => (await apiClient.get<{ enabled: boolean; online: boolean; modelInstalled: boolean }>('/assistant/status')).data,
  conversations: async () => (await apiClient.get<{ id: string; title: string | null; createdAt: string; lastMessage: string | null }[]>('/assistant/conversations')).data,
  create: async (title?: string) => (await apiClient.post<{ id: string }>('/assistant/conversations', { title })).data,
  get: async (id: string) => (await apiClient.get<{ id: string; title: string | null; messages: ChatMessageView[] }>(`/assistant/conversations/${id}`)).data,
  send: async (id: string, content: string) =>
    (await apiClient.post<{ message: ChatMessageView; assistant: ChatMessageView; engine: string }>(`/assistant/conversations/${id}/messages`, { content }, { timeout: 120000 })).data,
  remove: async (id: string) => (await apiClient.delete(`/assistant/conversations/${id}`)).data,
  explain: async (kind: string, data: Record<string, unknown>, question?: string) =>
    (await apiClient.post<{ explanation: string; engine: string }>('/assistant/explain', { kind, data, question }, { timeout: 120000 })).data,
};

/** HU-031. */
export const incidentsApi = {
  create: async (input: { type: string; title: string; description: string; context?: Record<string, unknown> }) =>
    (await apiClient.post('/incidents', input)).data,
  mine: async () =>
    (await apiClient.get<{ id: string; type: string; title: string; status: string; response: string | null; createdAt: string }[]>('/incidents/mine')).data,
};

/** HU-029/034: consentimientos de fotografía. */
export const consentApi = {
  list: async () => (await apiClient.get<{ consentType: string; accepted: boolean; createdAt: string }[]>('/privacy/consents')).data,
  set: async (consentType: 'photo_analysis' | 'photo_retention', accepted: boolean) =>
    (await apiClient.post('/privacy/consents', { consentType, accepted, policyVersion: 'v2.0' })).data,
  async current(type: 'photo_analysis' | 'photo_retention'): Promise<boolean> {
    const rows = await this.list();
    const latest = rows.filter((r) => r.consentType === type).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    return Boolean(latest?.accepted);
  },
};

/** Espera (con sondeo) a que una tarea termine; útil en flujos que necesitan el resultado. */
export async function waitForTask<R = any>(initial: TaskView<R>, onProgress?: (p: number) => void, maxMs = 180000): Promise<TaskView<R>> {
  let t = initial;
  const start = Date.now();
  while (t.status === 'pendiente' || t.status === 'procesando') {
    if (Date.now() - start > maxMs) throw new Error('El análisis está tardando más de lo normal.');
    await new Promise((r) => setTimeout(r, 1500));
    t = await tasksApi.get<R>(t.id);
    onProgress?.(t.progress);
  }
  return t;
}
