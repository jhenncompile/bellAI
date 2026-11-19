export type WardrobeCategory =
  | 'superior'
  | 'inferior'
  | 'calzado'
  | 'abrigo'
  | 'accesorio';

export const WARDROBE_SUBCATEGORIES = [
  'blusas',
  'camisas',
  'camisetas',
  'tops',
  'vestidos',
  'pantalones',
  'jeans',
  'faldas',
  'shorts',
  'chaquetas',
  'abrigos',
  'sueteres',
  'blazers',
  'zapatillas',
  'tacones',
  'botas',
  'sandalias',
  'bolsos',
  'cinturones',
  'joyeria',
  'sombreros',
  'bufandas',
  'lentes',
  'relojes',
  'otros',
] as const;

export type WardrobeSubcategory = (typeof WARDROBE_SUBCATEGORIES)[number];

export const SUBCATEGORY_TO_CATEGORY: Record<WardrobeSubcategory, WardrobeCategory> = {
  blusas: 'superior',
  camisas: 'superior',
  camisetas: 'superior',
  tops: 'superior',
  vestidos: 'superior',
  pantalones: 'inferior',
  jeans: 'inferior',
  faldas: 'inferior',
  shorts: 'inferior',
  chaquetas: 'abrigo',
  abrigos: 'abrigo',
  sueteres: 'abrigo',
  blazers: 'abrigo',
  zapatillas: 'calzado',
  tacones: 'calzado',
  botas: 'calzado',
  sandalias: 'calzado',
  bolsos: 'accesorio',
  cinturones: 'accesorio',
  joyeria: 'accesorio',
  sombreros: 'accesorio',
  bufandas: 'accesorio',
  lentes: 'accesorio',
  relojes: 'accesorio',
  otros: 'superior',
};

export type WardrobeSeason = 'primavera' | 'verano' | 'otono' | 'invierno' | 'todo_el_ano';

export type WardrobeOccasion =
  | 'casual'
  | 'formal'
  | 'fiesta'
  | 'deporte'
  | 'trabajo'
  | 'playa'
  | 'gala';

export const WARDROBE_OCCASIONS: WardrobeOccasion[] = [
  'casual',
  'formal',
  'fiesta',
  'deporte',
  'trabajo',
  'playa',
  'gala',
];

export type WardrobeStatus = 'confirmed' | 'draft' | 'upload_failed';

export type CaptureSource = 'camera' | 'gallery';

export interface WardrobeBottomDetails {
  color: string;
  colorHex: string;
  approximateSize: string;
  season: string;
  occasion?: WardrobeOccasion | null;
  categoryLabel: string;
}

export interface WardrobeUsageStats {
  addedAt: string;
  updatedAt: string;
  lastWornAt: string | null;
  wearCount: number;
}

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  status: WardrobeStatus;
  captureSource: CaptureSource;
  originalImageUrl: string | null;
  enhancedImageUrl: string | null;
  bottomDetails: WardrobeBottomDetails;
  usageStats: WardrobeUsageStats;
  actions: {
    canWear?: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  aiMetadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  /** Ruta local cuando el borrador se conserva offline en el teléfono */
  localPhotoUri?: string | null;
}

export interface WardrobeGridItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  categoryLabel: string;
  photoUrl: string | null;
  imageUrl: string | null;
  color: string;
  colorHex: string;
  season: string;
  occasion?: WardrobeOccasion | null;
  status: WardrobeStatus;
  addedAt: string;
  lastWornAt: string | null;
}

export interface EmptyWardrobeStateInfo {
  title: string;
  message: string;
  ctaLabel: string;
}

export interface WardrobeSummary {
  totalConfirmed: number;
  totalDrafts: number;
  byCategory: Record<WardrobeCategory, number>;
  bySubcategory: Record<string, number>;
}

export interface WardrobeListResponse {
  isEmpty: boolean;
  emptyState: EmptyWardrobeStateInfo | null;
  summary: WardrobeSummary;
  grid: WardrobeGridItem[];
  items: WardrobeItem[];
}

export interface WardrobeScanPayload {
  photoUri?: string | null;
  photoFileName?: string;
  photoMimeType?: string;
  name?: string;
  category?: WardrobeCategory;
  subcategory?: WardrobeSubcategory;
  color?: string;
  /** Color hexadecimal elegido o confirmado por la usuaria (#RRGGBB). */
  colorHex?: string | null;
  approximateSize?: string;
  season?: WardrobeSeason;
  occasion?: WardrobeOccasion;
  captureSource: CaptureSource;
  draftId?: string;
}

export interface WardrobeScanResponse {
  savedAsDraft: boolean;
  message: string;
  errorDetail?: string;
  item: WardrobeItem;
}

export interface WardrobeHistoryEntry {
  id: string;
  actionCode: string;
  actionType: 'agregar' | 'editar' | 'eliminar' | 'usar';
  description: string;
  itemId: string | null;
  itemName: string | null;
  category: string | null;
  subcategory: string | null;
  occurredAt: string;
}

export interface WardrobeActionHistoryItem {
  id: string;
  itemId: string;
  action: 'agregar' | 'editar' | 'eliminar';
  label: string;
  timestamp: string;
  formattedDate: string;
  itemSnapshot?: {
    name: string;
    category: WardrobeCategory;
    imageUrl: string | null;
  };
}

export interface WardrobeHistoryResponse {
  total: number;
  history: WardrobeHistoryEntry[];
}

export interface WardrobeSyncStatus {
  cloudAvailable: boolean;
  autoBackupEnabled: boolean;
  offlineModeEnabled: boolean;
  lastSyncedAt: string | null;
}

export interface OfflineSyncStatus {
  lastSyncedAt: string | null;
  pendingUploadsCount: number;
  autoBackupEnabled: boolean;
  offlineModeEnabled: boolean;
}

export interface WardrobeAccountSnapshot {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
}

export interface WardrobeSyncSnapshot {
  account: WardrobeAccountSnapshot | null;
  syncStatus: WardrobeSyncStatus;
  wardrobe: WardrobeListResponse;
  history: WardrobeHistoryEntry[];
}

export interface MobileCaptureConfig {
  permissionsRequired?: {
    camera: {
      android: string;
      ios: string;
      rationale: string;
    };
    gallery: {
      android: string;
      androidLegacy: string;
      ios: string;
      rationale: string;
    };
  };
  supportedSources?: CaptureSource[];
  cameraPermissionRequired?: boolean;
  galleryPermissionRequired?: boolean;
  categories: any;
  categoryLabels?: Record<WardrobeCategory, string>;
  subcategories?: any;
  subcategoryLabels?: Record<WardrobeSubcategory, string>;
  seasons?: WardrobeSeason[];
  occasions?: any;
  uploadConstraints?: {
    fieldName: string;
    maxFileSizeBytes: number;
    allowedMimeTypes: string[];
    captureSources: CaptureSource[];
  };
}

export const CATEGORY_LABELS: Record<WardrobeCategory, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  calzado: 'Calzado',
  abrigo: 'Abrigo',
  accesorio: 'Accesorio',
};

export const SUBCATEGORY_LABELS: Record<WardrobeSubcategory, string> = {
  blusas: 'Blusas',
  camisas: 'Camisas',
  camisetas: 'Camisetas',
  tops: 'Tops',
  vestidos: 'Vestidos',
  pantalones: 'Pantalones',
  jeans: 'Jeans',
  faldas: 'Faldas',
  shorts: 'Shorts',
  chaquetas: 'Chaquetas',
  abrigos: 'Abrigos',
  sueteres: 'Suéteres',
  blazers: 'Blazers',
  zapatillas: 'Zapatillas',
  tacones: 'Tacones',
  botas: 'Botas',
  sandalias: 'Sandalias',
  bolsos: 'Bolsos',
  cinturones: 'Cinturones',
  joyeria: 'Joyería',
  sombreros: 'Sombreros',
  bufandas: 'Bufandas',
  lentes: 'Lentes',
  relojes: 'Relojes',
  otros: 'Otros',
};

export const CATEGORY_SUBCATEGORIES: Record<WardrobeCategory, WardrobeSubcategory[]> = {
  superior: ['blusas', 'camisas', 'camisetas', 'tops', 'vestidos', 'otros'],
  inferior: ['pantalones', 'jeans', 'faldas', 'shorts'],
  calzado: ['zapatillas', 'tacones', 'botas', 'sandalias'],
  abrigo: ['chaquetas', 'abrigos', 'sueteres', 'blazers'],
  accesorio: ['bolsos', 'cinturones', 'joyeria', 'sombreros', 'bufandas', 'lentes', 'relojes'],
};

export const OCCASION_LABELS: Record<WardrobeOccasion, string> = {
  casual: 'Casual',
  formal: 'Formal',
  fiesta: 'Fiesta',
  deporte: 'Deporte',
  trabajo: 'Trabajo',
  playa: 'Playa',
  gala: 'Gala',
};

export const SEASON_LABELS: Record<WardrobeSeason, string> = {
  primavera: 'Primavera',
  verano: 'Verano',
  otono: 'Otoño',
  invierno: 'Invierno',
  todo_el_ano: 'Todo el año',
};

/**
 * HU-24: Evaluación de compatibilidad de prenda de tienda con perfil y armario.
 */
export type CompatibilityLevel = 'alto' | 'medio' | 'bajo';

export interface EvaluateStoreGarmentPayload {
  name?: string;
  category: WardrobeCategory;
  subcategory?: WardrobeSubcategory;
  color?: string;
  colorHex?: string;
  season?: WardrobeSeason;
  occasion?: WardrobeOccasion;
  storeName?: string;
  price?: number;
}

export interface StoreGarmentMatchingItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  subcategory: WardrobeSubcategory;
  categoryLabel: string;
  color: string | null;
  colorHex: string | null;
  photoUrl: string | null;
  matchReason: string;
}

export interface StoreGarmentEvaluationResponse {
  compatibilityLevel: CompatibilityLevel;
  compatibilityScore: number;
  verdictTitle: string;
  summary: string;
  colorAnalysis: {
    seasonalHarmony: 'favorable' | 'neutro' | 'desfavorable';
    userSeason: string;
    userUndertone: string;
    colorEvaluated: string;
    description: string;
  };
  wardrobeAnalysis: {
    matchingCount: number;
    description: string;
  };
  matchingWardrobeItems: StoreGarmentMatchingItem[];
  recommendationTips: string[];
  /** Lo que la IA detectó en la foto de la tienda (ausente sin foto o sin servicio de IA) */
  detectedFromPhoto?: {
    subcategory: string;
    color: string;
    colorHex: string;
    pattern: string | null;
    confidence: number | null;
  } | null;
  /** Prendas del armario casi iguales: mismo tipo, mismo color y estampado; o la misma prenda */
  similarWardrobeItems?: (StoreGarmentMatchingItem & { colorDifference: number | null; likelyDuplicate: boolean })[];
}
