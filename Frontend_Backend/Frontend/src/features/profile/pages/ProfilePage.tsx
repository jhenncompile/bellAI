import { useCallback, useState, useEffect } from 'react';
import { User, Save } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { AlertMessage, type FeedbackMessage } from '@/shared/components/feedback/AlertMessage';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { EncryptionBanner } from '../components/EncryptionBanner';
import { ProfilePublicDataCard } from '../components/ProfilePublicDataCard';
import { ProfileSensitiveDataCard } from '../components/ProfileSensitiveDataCard';
import { profileService } from '../services/profile.service';
import type { ProfileFormValues, UserProfileResponse } from '../types/profile.types';

const TAMANO_MAXIMO_AVATAR = 5 * 1024 * 1024; // 5 MB

const VALORES_INICIALES: ProfileFormValues = {
  name: '',
  bio: '',
  phone: '',
  address: '',
  birthDate: '',
  avatarUrl: '',
};

export function ProfilePage() {
  const currentUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);

  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [formData, setFormData] = useState<ProfileFormValues>(VALORES_INICIALES);

  const loadProfile = useCallback(async () => {
    try {
      const data = await profileService.getProfile();
      setProfileData(data);
      setFormData({
        name: data.name || '',
        bio: data.profile.bio || '',
        phone: data.profile.phone || '',
        address: data.profile.address || '',
        birthDate: data.profile.birthDate ? data.profile.birthDate.slice(0, 10) : '',
        avatarUrl: data.profile.avatarUrl || '',
      });
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar los datos del perfil' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProfile);
  }, [loadProfile]);

  const handleFormChange = (patch: Partial<ProfileFormValues>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

  const handleSelectAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'El archivo debe ser una imagen válida (JPG, PNG, WebP)' });
      return;
    }

    if (file.size > TAMANO_MAXIMO_AVATAR) {
      setMessage({ type: 'error', text: 'La imagen no debe superar los 5MB' });
      return;
    }

    try {
      setUploadingImage(true);
      setMessage(null);
      const res = await profileService.uploadAvatar(file);
      // Se guarda la URL tal como la da la API; al mostrarla, `getAvatarUrl` la resuelve contra el
      // servidor real (reescribe `localhost`, que desde otro equipo de la red no es el servidor).
      const newAvatarUrl = res.url;

      setFormData((prev) => ({ ...prev, avatarUrl: newAvatarUrl }));

      // Guardar de inmediato en el perfil
      await profileService.updateProfile({ avatarUrl: newAvatarUrl });

      if (currentUser) {
        setUser({ ...currentUser, avatar: newAvatarUrl });
      }

      setMessage({ type: 'success', text: '¡Avatar optimizado a WebP y actualizado con éxito!' });
    } catch {
      setMessage({ type: 'error', text: 'Error al procesar la imagen con Sharp' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);
      const updated = await profileService.updateProfile(formData);
      setProfileData(updated);

      if (currentUser) {
        setUser({
          ...currentUser,
          name: updated.name,
          avatar: updated.profile.avatarUrl,
        });
      }

      setMessage({ type: 'success', text: '¡Perfil y datos cifrados actualizados con éxito!' });
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar los cambios del perfil' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <User className="size-6 text-primary" />
          Mi Perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tu información personal, avatar optimizado y credenciales de acceso.
        </p>
      </div>

      <EncryptionBanner />

      <AlertMessage message={message} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <ProfilePublicDataCard
          values={formData}
          email={profileData?.email || ''}
          uploading={uploadingImage}
          onChange={handleFormChange}
          onSelectAvatar={handleSelectAvatar}
        />

        <ProfileSensitiveDataCard
          values={formData}
          phoneMasked={profileData?.profile.phoneMasked}
          onChange={handleFormChange}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving ? 'Guardando cambios...' : 'Guardar Perfil'}
          </button>
        </div>
      </form>
    </div>
  );
}
