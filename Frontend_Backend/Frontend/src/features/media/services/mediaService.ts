import { apiClient } from '@/shared/lib/axios';

export type MediaType = 'photo' | 'garment' | 'model_3d' | 'ai_component' | 'texture' | 'avatar';
export type SystemFunction =
  | 'catalogo_prendas'
  | 'probador_virtual_3d'
  | 'motor_inferencia_ia'
  | 'perfil_usuario'
  | 'galeria_marketing'
  | 'general';

export interface MediaAsset {
  id: string;
  userId: string | null;
  title: string;
  originalFilename: string;
  s3Key: string;
  s3Bucket: string;
  s3Url: string;
  cdnUrl: string;
  mediaType: MediaType;
  systemFunction: SystemFunction;
  isActive: boolean;
  usedByComponents: string[];
  status: 'active' | 'retired' | 'maintenance';
  mimeType: string;
  extension: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStats {
  totalAssets: number;
  totalStorageBytes: number;
  totalStorageFormatted: string;
  breakdown: {
    photos: number;
    garments: number;
    models3d: number;
    aiComponents: number;
    textures: number;
  };
  supervision: {
    activeWithDependencies: number;
    protectedFromDeletion: number;
    totalSupervised: number;
  };
  cdnStatus: {
    provider: string;
    bucket: string;
    region: string;
    cdnBaseUrl: string;
    edgeCaching: string;
    cacheTtl: string;
    corsEnabled: boolean;
  };
  /** CP-033-01/03: uso frente a la cuota configurada y alerta por encima del 90 %. */
  usage?: {
    usedBytes: number;
    usedFormatted: string;
    fileCount: number;
    quotaGb: number;
    usagePercent: number;
    alert: boolean;
    alertThresholdPercent: number;
  };
}

/** CP-033-04: resultado de la limpieza de archivos huérfanos. */
export interface OrphanCleanupResult {
  dryRun: boolean;
  orphanCount: number;
  orphanBytes: number;
  freedBytes: number;
  files: { path: string; sizeBytes: number; reason: string }[];
}

export interface DependencyVerificationResult {
  canDelete: boolean;
  activeDependencies: string[];
  warningMessage?: string;
  asset: MediaAsset;
}

export const mediaService = {
  /**
   * Obtiene la lista de elementos multimedia y modelos con filtros por tipo y función
   */
  async listMedia(
    type?: string,
    functionTag?: string,
    search?: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const params = new URLSearchParams();
    if (type && type !== 'all') params.append('type', type);
    if (functionTag && functionTag !== 'all') params.append('functionTag', functionTag);
    if (search) params.append('search', search);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await apiClient.get<{
      data: MediaAsset[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/media?${params.toString()}`);
    return response.data;
  },

  /**
   * Obtiene estadísticas globales de supervisión y almacenamiento
   */
  async cleanupOrphans(dryRun: boolean): Promise<OrphanCleanupResult> {
    const response = await apiClient.post<OrphanCleanupResult>('/media/cleanup-orphans', undefined, { params: { dryRun } });
    return response.data;
  },

  async getStorageStats() {
    const response = await apiClient.get<StorageStats>('/media/stats/overview');
    return response.data;
  },

  /**
   * Verifica las dependencias de un recurso antes de retirar o eliminar (Regla HU-033)
   */
  async verifyDependencies(id: string) {
    const response = await apiClient.get<DependencyVerificationResult>(`/media/${id}/dependencies`);
    return response.data;
  },

  /**
   * Sube un archivo multimedia o modelo supervisado
   */
  async uploadMedia(
    file: File,
    options?: {
      title?: string;
      mediaType?: MediaType;
      systemFunction?: SystemFunction;
      textureType?: string;
      usedByComponents?: string[];
    },
    onProgress?: (percent: number) => void,
  ) {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.title) formData.append('title', options.title);
    if (options?.mediaType) formData.append('mediaType', options.mediaType);
    if (options?.systemFunction) formData.append('systemFunction', options.systemFunction);
    if (options?.textureType) formData.append('textureType', options.textureType);
    if (options?.usedByComponents) {
      options.usedByComponents.forEach((comp) => formData.append('usedByComponents[]', comp));
    }

    const response = await apiClient.post<MediaAsset>('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return response.data;
  },

  /**
   * Genera una URL prefirmada para subida directa a S3 (Direct-to-S3 Upload)
   */
  async createPresignedUpload(params: {
    filename: string;
    contentType: string;
    mediaType: MediaType;
    systemFunction?: SystemFunction;
    title?: string;
    textureType?: string;
    usedByComponents?: string[];
  }) {
    const response = await apiClient.post<{
      uploadUrl: string;
      key: string;
      cdnUrl: string;
      s3Url: string;
      mediaType: string;
      systemFunction: string;
      originalFilename: string;
      mimeType: string;
      extension: string;
      suggestedTitle: string;
    }>('/media/presigned-upload', params);
    return response.data;
  },

  /**
   * Confirma la subida directa en S3 y registra el activo
   */
  async confirmPresignedUpload(payload: {
    key: string;
    originalFilename: string;
    title: string;
    mediaType: MediaType;
    systemFunction?: SystemFunction;
    mimeType: string;
    sizeBytes?: number;
    textureType?: string;
    usedByComponents?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const response = await apiClient.post<MediaAsset>('/media/confirm-upload', payload);
    return response.data;
  },

  /**
   * Retira de forma segura un recurso del sistema (marca como retirado e inactivo)
   */
  async retireMedia(id: string) {
    const response = await apiClient.patch<MediaAsset>(`/media/${id}/retire`);
    return response.data;
  },

  /**
   * Elimina un recurso multimedia o modelo con verificación de dependencias
   */
  async deleteMedia(id: string, force: boolean = false) {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/media/${id}${force ? '?force=true' : ''}`,
    );
    return response.data;
  },
};
