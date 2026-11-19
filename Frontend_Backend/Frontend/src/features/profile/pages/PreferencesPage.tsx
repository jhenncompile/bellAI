import { useCallback, useState, useEffect } from 'react';
import { Sliders, Save } from 'lucide-react';
import { AlertMessage, type FeedbackMessage } from '@/shared/components/feedback/AlertMessage';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { useUIStore } from '@/shared/store/ui.store';
import { LanguageConsentsCard } from '../components/LanguageConsentsCard';
import { NotificationChannelsCard } from '../components/NotificationChannelsCard';
import { ThemeSelectorCard } from '../components/ThemeSelectorCard';
import { profileService } from '../services/profile.service';
import type { PreferencesFormValues, ThemePreference } from '../types/profile.types';

const VALORES_INICIALES: PreferencesFormValues = {
  theme: 'system',
  language: 'es',
  emailNotifications: true,
  pushNotifications: true,
  marketingConsent: false,
  trackingConsent: false,
};

export function PreferencesPage() {
  const currentTheme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [preferences, setPreferences] = useState<PreferencesFormValues>(VALORES_INICIALES);

  const loadPreferences = useCallback(async () => {
    try {
      const data = await profileService.getProfile();
      setPreferences({
        theme: data.preferences.theme || currentTheme || 'system',
        language: data.preferences.language || 'es',
        emailNotifications: data.preferences.emailNotifications ?? true,
        pushNotifications: data.preferences.pushNotifications ?? true,
        marketingConsent: data.preferences.marketingConsent ?? false,
        trackingConsent: data.preferences.trackingConsent ?? false,
      });
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar las preferencias del usuario' });
    } finally {
      setLoading(false);
    }
  }, [currentTheme]);

  useEffect(() => {
    void Promise.resolve().then(loadPreferences);
  }, [loadPreferences]);

  const handleChange = (patch: Partial<PreferencesFormValues>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  };

  const handleThemeChange = (newTheme: ThemePreference) => {
    handleChange({ theme: newTheme });

    if (newTheme === 'dark' || newTheme === 'light') {
      setTheme(newTheme);
      return;
    }

    // 'system': seguir la preferencia del sistema operativo
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      await profileService.updatePreferences(preferences);
      setMessage({
        type: 'success',
        text: '¡Preferencias actualizadas e invalidadas en caché con éxito!',
      });
    } catch {
      setMessage({ type: 'error', text: 'Error al actualizar las preferencias' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sliders className="size-6 text-primary" />
          Preferencias del Sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          Personaliza tu experiencia visual, canales de notificación e idioma de la interfaz.
        </p>
      </div>

      <AlertMessage message={message} />

      <form onSubmit={handleSave} className="space-y-6">
        <ThemeSelectorCard value={preferences.theme} onChange={handleThemeChange} />
        <NotificationChannelsCard values={preferences} onChange={handleChange} />
        <LanguageConsentsCard values={preferences} onChange={handleChange} />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving ? 'Guardando...' : 'Guardar Preferencias'}
          </button>
        </div>
      </form>
    </div>
  );
}
