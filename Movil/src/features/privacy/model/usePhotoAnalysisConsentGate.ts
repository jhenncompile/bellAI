import { useCallback, useRef, useState } from 'react';
import {
  PhotoAnalysisConsentRequiredError,
  privacyService,
} from '../api/privacyService';

type AnalysisTask = () => Promise<unknown>;

export function usePhotoAnalysisConsentGate() {
  const pendingTask = useRef<AnalysisTask | null>(null);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const runWithConsent = useCallback(async (task: AnalysisTask) => {
    try {
      await privacyService.assertPhotoAnalysisConsent();
      await task();
      return true;
    } catch (requestError) {
      if (requestError instanceof PhotoAnalysisConsentRequiredError) {
        pendingTask.current = task;
        setError('');
        setVisible(true);
        return false;
      }
      throw requestError;
    }
  }, []);

  const grantConsent = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await privacyService.recordPhotoAnalysisConsent(true);
      await privacyService.assertPhotoAnalysisConsent();
      const task = pendingTask.current;
      pendingTask.current = null;
      setVisible(false);
      if (task) await task();
    } catch {
      setError(
        'No pudimos confirmar tu autorización. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  const denyConsent = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await privacyService.recordPhotoAnalysisConsent(false);
      pendingTask.current = null;
      setVisible(false);
    } catch {
      setError(
        'No pudimos guardar tu decisión. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  return {
    visible,
    submitting,
    error,
    runWithConsent,
    grantConsent,
    denyConsent,
  };
}
