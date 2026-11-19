import { apiClient } from '@/shared/lib/axios';
import type { AiModel, AiModelsResponse, CreateAiModelInput, ModelCheck, TaskStat } from '../types/ai-models.types';

export const aiModelsService = {
  async list(): Promise<AiModelsResponse> {
    const { data } = await apiClient.get<AiModelsResponse>('/admin/ai-models');
    return data;
  },
  async create(input: CreateAiModelInput): Promise<AiModel> {
    const { data } = await apiClient.post<AiModel>('/admin/ai-models', input);
    return data;
  },
  async sync(): Promise<{ created: string[] }> {
    const { data } = await apiClient.post<{ created: string[] }>('/admin/ai-models/sync');
    return data;
  },
  async check(id: string): Promise<ModelCheck> {
    const { data } = await apiClient.post<ModelCheck>(`/admin/ai-models/${id}/check`);
    return data;
  },
  async activate(id: string): Promise<AiModel> {
    const { data } = await apiClient.post<AiModel>(`/admin/ai-models/${id}/activate`);
    return data;
  },
  async deactivate(id: string): Promise<AiModel> {
    const { data } = await apiClient.post<AiModel>(`/admin/ai-models/${id}/deactivate`);
    return data;
  },
  /** CP-032-04: el servidor rechaza formatos no soportados con un mensaje claro. */
  async uploadArtifact(id: string, file: File): Promise<AiModel> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<AiModel>(`/admin/ai-models/${id}/artifact`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000 });
    return data;
  },
  async taskStats(): Promise<TaskStat[]> {
    const { data } = await apiClient.get<TaskStat[]>('/tasks/stats');
    return data;
  },
};
