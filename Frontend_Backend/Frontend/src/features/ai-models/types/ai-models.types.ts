export type ModelEnvironment = 'desarrollo' | 'pruebas' | 'produccion';
export type ModelStatus = 'registrado' | 'activo' | 'inactivo' | 'fallido';

export interface ModelCheck {
  compatible: boolean;
  error?: string;
  latencyMs?: number;
  version?: string;
  checkedAt?: string;
}

export interface AiModel {
  id: string;
  name: string;
  task: string;
  version: string;
  environment: ModelEnvironment;
  status: ModelStatus;
  description: string | null;
  metrics: Record<string, unknown>;
  lastCheck: ModelCheck | null;
  activatedAt: string | null;
  createdAt: string;
}

export interface ServiceAnalyzer {
  name: string;
  task: string;
  version: string;
  available: boolean;
  missingModels: string[];
  description: string;
}

export interface AiModelsResponse {
  environment: ModelEnvironment;
  serviceOnline: boolean;
  serviceAnalyzers: ServiceAnalyzer[];
  models: AiModel[];
}

export interface TaskStat {
  type: string;
  total: number;
  completed: number;
  failed: number;
  active: number;
  avgSeconds: string | null;
}

export interface CreateAiModelInput {
  name: string;
  task: string;
  version: string;
  environment: ModelEnvironment;
  description?: string;
}
