export type IncidentStatus = 'abierta' | 'en_proceso' | 'resuelta' | 'cerrada';
export type IncidentPriority = 'baja' | 'media' | 'alta';
export type IncidentType = 'error' | 'analisis' | 'armario' | 'cuenta' | 'privacidad' | 'sugerencia' | 'otro';

export interface Incident {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  type: IncidentType;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  context: Record<string, unknown>;
  response: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface IncidentsResult {
  data: Incident[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface IncidentStats {
  open: number;
  inProgress: number;
  resolved: number;
  highPriority: number;
  avgResolutionHours: string | null;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  type?: IncidentType;
  priority?: IncidentPriority;
  search?: string;
  page?: number;
}

export const STATUS_LABELS: Record<IncidentStatus, string> = { abierta: 'Abierta', en_proceso: 'En proceso', resuelta: 'Resuelta', cerrada: 'Cerrada' };
export const TYPE_LABELS: Record<IncidentType, string> = {
  error: 'Error', analisis: 'Análisis', armario: 'Armario', cuenta: 'Cuenta', privacidad: 'Privacidad', sugerencia: 'Sugerencia', otro: 'Otro',
};
export const PRIORITY_LABELS: Record<IncidentPriority, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
