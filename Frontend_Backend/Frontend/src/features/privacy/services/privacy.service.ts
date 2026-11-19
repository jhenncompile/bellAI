import { apiClient } from '@/shared/lib/axios';
import type {
  AuditLogRecord,
  ConsentRecord,
  RightToBeForgottenResponse,
  PrivacyDataSummary,
} from '../types/privacy.types';

export const privacyService = {
  async getDataSummary(): Promise<PrivacyDataSummary> {
    const { data } = await apiClient.get<PrivacyDataSummary>('/privacy/data-summary');
    return data;
  },

  /**
   * Descarga directamente en el navegador del usuario el archivo JSON de sus datos personales bajo RGPD
   */
  async downloadGdprExport(): Promise<void> {
    const response = await apiClient.get('/privacy/export', {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mis_datos_gdpr_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async getConsents(): Promise<ConsentRecord[]> {
    const { data } = await apiClient.get<ConsentRecord[]>('/privacy/consents');
    return data;
  },

  async recordConsent(consentType: string, accepted: boolean): Promise<ConsentRecord> {
    const { data } = await apiClient.post<ConsentRecord>('/privacy/consents', {
      consentType,
      accepted,
      policyVersion: 'v1.0',
    });
    return data;
  },

  async requestRightToBeForgotten(password: string, reason?: string): Promise<RightToBeForgottenResponse> {
    const { data } = await apiClient.post<RightToBeForgottenResponse>(
      '/privacy/right-to-be-forgotten',
      { confirm: true, password, reason },
    );
    return data;
  },

  async getAuditLogs(): Promise<AuditLogRecord[]> {
    const { data } = await apiClient.get<AuditLogRecord[]>('/privacy/audit-logs');
    return data;
  },
};
