import { apiClient } from '@/shared/lib/axios';
import type { Incident, IncidentFilters, IncidentPriority, IncidentStats, IncidentStatus, IncidentsResult } from '../types/incidents.types';

export const incidentsService = {
  async list(filters: IncidentFilters): Promise<IncidentsResult> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
    const { data } = await apiClient.get<IncidentsResult>('/admin/incidents', { params });
    return data;
  },
  async stats(): Promise<IncidentStats> {
    const { data } = await apiClient.get<IncidentStats>('/admin/incidents/stats');
    return data;
  },
  async update(id: string, input: { status?: IncidentStatus; priority?: IncidentPriority; response?: string }): Promise<Incident> {
    const { data } = await apiClient.patch<Incident>(`/admin/incidents/${id}`, input);
    return data;
  },
};
