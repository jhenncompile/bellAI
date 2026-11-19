import { apiClient } from '@/shared/lib/axios';
import type { DashboardMetrics } from '../types/dashboard.types';

export const dashboardService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await apiClient.get<DashboardMetrics>('/admin/dashboard');
    return response.data;
  },
};
