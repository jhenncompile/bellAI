import { useCallback, useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { AlertMessage, type FeedbackMessage } from '@/shared/components/feedback/AlertMessage';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { getApiErrorMessage, getApiErrorStatus } from '@/shared/lib/api-error';
import { ConsentsCard } from '../components/ConsentsCard';
import { DangerZoneCard } from '../components/DangerZoneCard';
import { DataExportCard } from '../components/DataExportCard';
import { EncryptionStatusCard } from '../components/EncryptionStatusCard';
import { ForgetMeDialog } from '../components/ForgetMeDialog';
import { privacyService } from '../services/privacy.service';
import type { ConsentRecord } from '../types/privacy.types';

export function PrivacyPage() {
  const logout = useAuthStore((state) => state.logout);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadConsents = useCallback(async () => {
    try {
      const data = await privacyService.getConsents();
      setConsents(data);
    } catch {
      setMessage({ type: 'error', text: 'Error al consultar el registro de consentimientos' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadConsents);
  }, [loadConsents]);

  const handleDownloadExport = async () => {
    try {
      setExporting(true);
      setMessage(null);
      await privacyService.downloadGdprExport();
      setMessage({
        type: 'success',
        text: '¡Archivo JSON con la copia completa de tus datos descargado con éxito!',
      });
    } catch {
      setMessage({ type: 'error', text: 'Error al generar la exportación de datos' });
    } finally {
      setExporting(false);
    }
  };

  const handleToggleConsent = async (type: string, currentState: boolean) => {
    try {
      setMessage(null);
      const updated = await privacyService.recordConsent(type, !currentState);
      setConsents((prev) => [updated, ...prev.filter((c) => c.consentType !== type)]);
      setMessage({
        type: 'success',
        text: `Consentimiento para "${type}" actualizado correctamente.`,
      });
    } catch {
      setMessage({ type: 'error', text: 'Error al registrar el consentimiento' });
    }
  };

  const handleExecuteRightToBeForgotten = async (reason: string, password: string) => {
    try {
      setDeleting(true);
      setMessage(null);
      await privacyService.requestRightToBeForgotten(password, reason);
      setShowDeleteModal(false);
      alert(
        'Tu cuenta, fotografías y datos personales se eliminaron. Se cerrará la sesión.',
      );
      logout();
    } catch (error) {
      setMessage({
        type: 'error',
        text: getApiErrorStatus(error) === 401
          ? 'La contraseña no es correcta. No se eliminó ningún dato.'
          : getApiErrorMessage(error, 'Error al procesar la solicitud de eliminación'),
      });
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Lock className="size-6 text-primary" />
          Panel de Privacidad y RGPD / GDPR
        </h1>
        <p className="text-sm text-muted-foreground">
          Ejerce tus derechos de portabilidad de datos, gestión de consentimientos y derecho al
          olvido.
        </p>
      </div>

      <AlertMessage message={message} />

      <DataExportCard exporting={exporting} onDownload={handleDownloadExport} />

      <EncryptionStatusCard />

      <ConsentsCard consents={consents} onToggle={handleToggleConsent} />

      <DangerZoneCard onRequestDeletion={() => setShowDeleteModal(true)} />

      <ForgetMeDialog
        isOpen={showDeleteModal}
        deleting={deleting}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleExecuteRightToBeForgotten}
      />
    </div>
  );
}
