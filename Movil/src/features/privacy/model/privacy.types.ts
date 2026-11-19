/**
 * Modelos de datos para el dominio de Privacidad y RGPD
 */

export interface UpdateConsentDto {
  consentType: string;
  accepted: boolean;
  policyVersion?: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string;
  accepted: boolean;
  policyVersion: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface RightToBeForgottenResponse {
  message: string;
  userId: string;
  scheduledAt?: string;
}
