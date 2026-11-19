/** Contratos de la API de BellAI consumidos por la app (espejo de los DTO del backend). */

export type TaskStatus = 'pendiente' | 'procesando' | 'completada' | 'fallida';

export interface TaskView<R = any> {
  id: string;
  type: string;
  status: TaskStatus;
  progress: number;
  result: R | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface Swatch {
  hex: string;
  name: string;
  category?: 'base' | 'acento' | 'neutro';
  usageTip?: string;
}

export interface IntegratedDiagnosis {
  id: string;
  createdAt: string;
  faceShape: string | null;
  skinTone: string | null;
  undertone: 'Calido' | 'Frio' | 'Neutro' | null;
  season: string | null;
  contrastLevel: 'Alto' | 'Medio' | 'Bajo' | null;
  bodyType: string | null;
  confidence: { face?: number; colorimetry?: number; body?: number; overall: number };
  modelVersions: Record<string, string>;
  summary: string;
  highlights: string[];
  palette: Swatch[];
  face: any;
  colorimetry: any;
  body: any;
  hair: any;
  recommendations: {
    colors: { recommended: Swatch[]; neutrals: Swatch[]; accents: Swatch[]; avoid: { hex: string; name: string; reason: string }[] };
    haircuts: string[];
    hairShades: string[];
    glasses: string[];
    necklines: string[];
    accessories: string[];
    metals: string[];
    lipsticks: string[];
    garmentCuts: string[];
    lines: string[];
    lengths: string[];
    /** Maquillaje según la geometría de ojos y labios (vacío si la cara estaba girada) */
    makeup?: string[];
    /** Cuidados según la textura del cabello (vacío si la textura es dudosa) */
    hairCare?: string[];
  };
  photosKept?: boolean;
}

export interface PhotoCheck {
  code: string;
  ok: boolean;
  message: string;
}

export interface PhotoValidation {
  valid: boolean;
  type: string;
  message: string;
  problems: PhotoCheck[];
  checks: PhotoCheck[];
}

export type DnaDimension = 'elegancia' | 'minimalismo' | 'romanticismo' | 'naturalidad' | 'dramatismo' | 'clasicismo' | 'experimentalidad';

export interface StyleDna {
  dimensions: Record<DnaDimension, number>;
  labels: Record<DnaDimension, { label: string; description: string }>;
  top: { dimension: DnaDimension; value: number; label: string; description: string }[];
  closestStyles: { style: string; similarity: number }[];
  interactions: number;
  sources: { declared: boolean; inferred: boolean; learned: boolean; wardrobe?: boolean };
  explanation: string[];
  /** HU-13: false si aún no hay preferencias, diagnóstico, armario ni valoraciones (perfil neutro) */
  hasData?: boolean;
  /** HU-13: cuánto aporta cada fuente al perfil (suma 100) */
  contributions?: { source: 'declared' | 'inferred' | 'wardrobe' | 'learned'; label: string; percent: number }[];
  wardrobeItems?: number;
  /** HU-13: cómo cambió el perfil en los últimos 90 días */
  evolution?: {
    since: string | null;
    changes: { dimension: DnaDimension; label: string; from: number; to: number; delta: number }[];
    timeline: { at: string; reason: string; reasonLabel: string; top: string[] }[];
  };
}

export interface Explanation {
  factor: string;
  value: string;
  rule: string;
}

export interface Recommendation {
  id: string;
  type: string;
  title: string;
  detail?: string;
  hex?: string;
  score: number;
  explanation: Explanation[];
  feedback?: FeedbackValue | null;
}

export interface RecommendationsResponse {
  rulesVersion: string;
  diagnosisAvailable: boolean;
  hint: string | null;
  occasion: string | null;
  count: number;
  items: Recommendation[];
}

export type FeedbackValue = 'me_gusta' | 'neutral' | 'no_me_gusta';

export interface Weather {
  source: 'open-meteo' | 'manual';
  temperatureC: number;
  summary: string;
  rainy: boolean;
  condition: 'frio' | 'templado' | 'calor';
}

export interface OutfitItem {
  id: string;
  name: string | null;
  category: string;
  subcategory: string;
  color: string | null;
  colorHex: string | null;
  imageUrl?: string | null;
  role: string;
}

export interface ScoreFactor {
  factor: string;
  score: number;
  detail: string;
}

export interface OutfitProposal {
  id: string;
  title: string;
  items: OutfitItem[];
  score: number;
  breakdown: ScoreFactor[];
  explanation: string[];
  missing: { role: string; suggestion: string }[];
  /** Vector de estilo del conjunto (para aprender del feedback). */
  dna?: Record<string, number>;
}

export interface GenerateOutfitsResponse {
  engineVersion: string;
  occasion: string | null;
  weather: Weather | null;
  wardrobeSize: number;
  hints: string[];
  proposals: OutfitProposal[];
}

export interface CompareResponse {
  weather: Weather | null;
  /** HU-21: cada opción trae sus puntos fuertes, sus puntos débiles y los factores en que gana */
  results: (OutfitProposal & { index: number; strengths?: string[]; weaknesses?: string[]; winsIn?: string[] })[];
  /** `tie`: las opciones están muy parejas; `summary`: por qué es la más conveniente */
  winner: { index: number; title: string; score: number; tie?: boolean; winsIn?: string[]; summary?: string } | null;
  /** `leader`: posición de la opción que gana ese factor con claridad (null si ninguna) */
  comparison: { factor: string; scores: number[]; decisive?: boolean; leader?: number | null }[];
}

/** HU-22: valoración de una combinación guardada. */
export type OutfitRating = 'agradable' | 'neutral' | 'no_agradable';

export interface SavedOutfit {
  id: string;
  title: string | null;
  explanation: string | null;
  weatherSummary: string | null;
  favorite: boolean;
  rating: OutfitRating | null;
  /** Solo al guardar: true si esa combinación ya estaba guardada (se actualizó, no se duplicó) */
  alreadySaved?: boolean;
  score: number | null;
  occasion: string | null;
  createdAt: string;
  items: Omit<OutfitItem, 'role'>[];
}

export interface CompatibilityResult {
  light: 'verde' | 'amarillo' | 'rojo';
  score: number;
  headline: string;
  factors: { factor: string; score: number; weight: number; detail: string }[];
  reasons: string[];
  recommendation: string;
  combinations: { count: number; examples: { items: { id: string; name: string | null; role: string }[]; score: number }[] };
  similarItems: { id: string; name: string | null; colorHex: string | null }[];
  budget: { price: number | null; limit: number | null; withinBudget: boolean | null };
  garment: { category: string; subcategory: string; color: string; colorHex: string; pattern: string; style: string | null; confidence: number };
}

export type SimulationKind = 'color_cabello' | 'maquillaje' | 'unas' | 'gafas' | 'prenda';

/** HU-022: prenda del armario que se puede probar sobre la foto. */
export interface TryOnGarment { id: string; name: string | null; category: string; region: 'superior' | 'inferior' | 'completo'; imageUrl: string }

export interface SimulationOptions {
  kinds: SimulationKind[];
  hair: { colors: Swatch[]; recommendedShades: string[]; styles: string[] };
  makeup: { lips: Swatch[]; recommendedLipsticks: string[] };
  nails: { colors: Swatch[] };
  glasses: { styles: { style: string; recommended: boolean }[]; frameColors: Swatch[]; reason: string };
  garment?: { items: TryOnGarment[]; note: string };
}

export interface SimulationResult {
  simulationId: string | null;
  saved: boolean;
  kind: SimulationKind;
  imageBase64: string;
  mime: string;
  meta: Record<string, unknown>;
}

/** HU-023: medidas del escaneo guiado (centímetros). */
export interface AvatarMeasurements {
  estaturaCm: number;
  pechoCm: number;
  bajoBustoCm: number;
  cinturaCm: number;
  caderaCm: number;
  anchoHombrosCm: number;
  largoBrazoCm: number;
  entrepiernaCm: number;
  musloCm: number;
  cuelloCm: number;
}

export interface AvatarScanSummary {
  measurements: AvatarMeasurements;
  appearance: { skinHex: string; hairHex: string; hairLength: 'Corto' | 'Medio' | 'Largo' };
  quality: { warnings: string[]; turnFramesUsed: number; angleCoverageDeg: number; headViewsUsed: string[] };
  createdAt?: string;
}

/** Malla del avatar escaneado: metros, Y hacia arriba, suelo en y = 0, mirando a +Z. */
export interface AvatarScanMesh {
  positions: number[];
  colors: number[];
  regions: number[];
  indices: number[];
  regionNames: Record<string, number>;
  levels: Record<string, number>;
  /** «maniqui»: avatar MakeHuman con cabello y ropa generados en el servidor. */
  style?: string;
  /** Prendas generadas en el servidor para el outfit (o la ropa genérica). */
  garments?: { kind: string; positions: number[]; indices: number[]; color: number[] }[];
  /** Deslizadores que el servidor ya aplicó a esta malla (la app solo aplica la diferencia). */
  applied?: Partial<Record<'heightScale' | 'complexionScale' | 'bustScale' | 'waistScale' | 'hipsScale' | 'shouldersScale', number>>;
}

export interface AvatarDiagnosisSummary {
  hasDiagnosis: boolean;
  createdAt: string | null;
  skinTone: string | null;
  undertone: string | null;
  bodyType: string | null;
  hairTexture: string | null;
  hairColor: string | null;
  eyeColorDetected: string | null;
}

export type AvatarPreset = 'rectangulo' | 'pera' | 'reloj' | 'triangulo_invertido' | 'redondo';

export interface AvatarConfig {
  version: string;
  source: 'escaneo' | 'diagnostico' | 'predeterminado';
  scan: AvatarScanSummary | null;
  bodyType: string | null;
  proportions: { shoulder: number; waist: number; hip: number; legToBody: number };
  skinHex: string;
  hairHex: string;
  hairLength: 'Corto' | 'Medio' | 'Largo';
  hairStyle?: 'Liso' | 'Ondulado' | 'Rizado' | 'Afro' | 'Bob' | 'Pixie' | 'Recogido' | 'Coleta';
  eyeColorHex?: string;
  complexion?: 'Esbelta' | 'Atlética' | 'Equilibrada' | 'Curvilínea' | 'Plena';
  complexionScale?: number;
  heightScale: number;
  bustScale?: number;
  waistScale?: number;
  hipsScale?: number;
  shouldersScale?: number;
  /** HU-023: silueta base del maniquí (la usuaria la elige; la IA solo la recomienda). */
  preset?: AvatarPreset;
  hairFringe?: boolean;
  recommendation?: { preset: AvatarPreset; reason: string } | null;
  hasBodyAnalysis: boolean;
  diagnosisInfo?: AvatarDiagnosisSummary | null;
  hint: string | null;
}

export interface AvatarGarment {
  id: string;
  name: string | null;
  category: string;
  subcategory: string;
  colorHex: string | null;
  slot: 'vestido' | 'torso' | 'cadera' | 'piernas' | 'abrigo' | 'pies' | 'accesorio';
  length: 'corto' | 'rodilla' | 'largo';
}

export interface HistoryEntry {
  kind: 'diagnostico' | 'valoracion' | 'outfit' | 'simulacion' | 'conversacion';
  id: string;
  at: string;
  title: string;
  detail: string | null;
}

export interface ChatMessageView {
  id: string;
  sender: 'usuaria' | 'asistente';
  content: string;
  createdAt: string;
}
