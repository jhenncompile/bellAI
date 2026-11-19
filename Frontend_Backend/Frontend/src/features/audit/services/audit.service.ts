import { apiClient } from '@/shared/lib/axios';
import type { AuditLogParams, AuditLogsResponse } from '../types/audit.types';

export const auditService = {
  async getAuditLogs(params: AuditLogParams): Promise<AuditLogsResponse> {
    const response = await apiClient.get<AuditLogsResponse>('/admin/audit-logs', { params });
    return response.data;
  },
};
