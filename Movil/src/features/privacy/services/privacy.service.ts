import { apiClient } from '@/shared/api/apiClient';
import {
  ConsentRecord,
  UpdateConsentDto,
  AuditLogRecord,
  RightToBeForgottenResponse,
} from '../model/privacy.types';

export const privacyService = {
  /**
   * Obtiene la lista de consentimientos del usuario (GET /api/privacy/consents)
   */
  async getConsents(): Promise<ConsentRecord[]> {
    const response = await apiClient.get<ConsentRecord[]>('/privacy/consents');
    return response.data;
  },

  /**
   * Registra un nuevo consentimiento o revocación (POST /api/privacy/consents)
   */
  async recordConsent(dto: UpdateConsentDto): Promise<ConsentRecord> {
    const response = await apiClient.post<ConsentRecord>('/privacy/consents', {
      consentType: dto.consentType,
      accepted: dto.accepted,
      policyVersion: dto.policyVersion || 'v1.0',
    });
    return response.data;
  },

  /**
   * Solicita el derecho al olvido y anonimización (POST /api/privacy/right-to-be-forgotten)
   */
  async requestRightToBeForgotten(reason?: string): Promise<RightToBeForgottenResponse> {
    const response = await apiClient.post<RightToBeForgottenResponse>(
      '/privacy/right-to-be-forgotten',
      { reason }
    );
    return response.data;
  },

  /**
   * Exporta todos los datos del usuario en formato JSON (GET /api/privacy/export)
   */
  async exportUserData(): Promise<Record<string, any>> {
    const response = await apiClient.get<Record<string, any>>('/privacy/export');
    return response.data;
  },

  /**
   * Consulta el registro de auditoría de privacidad (GET /api/privacy/audit-logs)
   */
  async getAuditLogs(): Promise<AuditLogRecord[]> {
    const response = await apiClient.get<AuditLogRecord[]>('/privacy/audit-logs');
    return response.data;
  },
};
