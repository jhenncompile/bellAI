import React, { useCallback, useEffect, useState } from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CU04LogoutView, CU07ProfilePreferencesView, CU11PrivacyDataView } from '@/views';
import type { PrivacyActionError } from '@/views/CU11PrivacyDataView';
import { useNotice } from '@/shared/ui';
import { hapticFeedback } from '@/shared/lib/haptics';
import { useAuth } from '@/features/auth/model/AuthContext';
import { useScanWorkflow } from '@/features/scan-diagnosis/model/useScanWorkflow';
import { offlineSyncStorage } from '@/features/digital-wardrobe/storage/offlineSyncStorage';
import { wardrobeService } from '@/features/digital-wardrobe/services/wardrobeService';
import { profileService } from '@/features/profile/api/profileService';
import type { ProfileFormValues } from '@/features/profile/api/profileService';
import { privacyService, PrivacyDataSummary } from '@/features/privacy/api/privacyService';
import { consentApi } from '@/features/bellai/api/bellaiApi';
import { MediaVaultService } from '@/entities/media-vault/model/mediaVaultService';
import { VaultItem } from '@/entities/media-vault/model/types';
import { UserProfile } from '@/entities/user/model/types';
import { clearUserProfile, getUserProfile, saveUserProfile } from '@/entities/user/model/storage';
import { AuraMemoryService } from '@/entities/memory/model/auraMemoryService';
import { AuraGoalService } from '@/entities/goal/model/auraGoalService';
import { clearWardrobeItems } from '@/features/wardrobe-matching/api/wardrobeService';
import { NoticeOutlet } from '@/shared/ui/Notice';
import { applyNotifications, notificationsActive } from '@/features/notifications';
import { profileService as accountService } from '@/features/profile/services/profile.service';
import { subscriptionApi, formatPlanDate, type SubscriptionStatus } from '@/features/subscription/api/subscriptionApi';

const emptyStylePreferences = {
  goals: [],
  preferredStyles: [],
  dislikedStyles: [],
  occasions: [],
  preferredColors: [],
  avoidedColors: [],
  budgetPerGarment: null,
};

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const { currentDiagnostic } = useScanWorkflow();
  const { notify } = useNotice();

  // Sin dato real (ni servidor ni copia local) no se muestra el número de prendas.
  const [garmentCount, setGarmentCount] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [planStatus, setPlanStatus] = useState<SubscriptionStatus | null>(null);

  // Al volver de la pantalla Premium el resumen del plan se actualiza
  useFocusEffect(useCallback(() => {
    subscriptionApi.me().then(setPlanStatus).catch(() => undefined);
  }, []));
  const planSummary = planStatus
    ? {
      isPremium: planStatus.isPremium,
      subtitle: planStatus.isPremium
        ? `Vigente hasta el ${formatPlanDate(planStatus.planExpiresAt)}.`
        : `Hazte Premium por ${planStatus.price.label} al mes.`,
    }
    : null;
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [profileFormValues, setProfileFormValues] = useState<ProfileFormValues>({
    name: user?.name || '',
    email: user?.email || '',
    avatarUrl: user?.avatarUri || '',
    phone: user?.phone || '',
    bio: '',
    address: '',
    birthDate: '',
    stylePreferences: emptyStylePreferences,
  });
  const [privacySummary, setPrivacySummary] = useState<PrivacyDataSummary | null>(null);
  const [localPhotos, setLocalPhotos] = useState<VaultItem[]>([]);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [photoConsentActive, setPhotoConsentActive] = useState(false);
  const [retentionActive, setRetentionActive] = useState(false);
  const [updatingRetention, setUpdatingRetention] = useState(false);
  const [updatingConsent, setUpdatingConsent] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Problemas dentro de Privacidad: se muestran en la propia vista (un aviso flotante quedaría bajo el modal).
  const [privacyActionError, setPrivacyActionError] = useState<(PrivacyActionError & { retryDownload?: boolean }) | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);

  useEffect(() => {
    notificationsActive().then(setNotificationsOn).catch(() => setNotificationsOn(false));
  }, []);

  /** HU-12 / HU-20: activa o desactiva los avisos en el teléfono y lo guarda en la cuenta. */
  const toggleNotifications = async (next: boolean) => {
    setNotificationsBusy(true);
    try {
      const active = await applyNotifications(next, { ask: next });
      setNotificationsOn(active);
      await accountService.updatePreferences({ pushNotifications: active }).catch(() => {});
      if (next && !active) {
        notify({ kind: 'info', message: 'Para recibirlas, permite las notificaciones de BellAI en los ajustes del teléfono.' });
      }
    } catch {
      notify({ kind: 'error', message: 'No pudimos cambiar las notificaciones. Inténtalo de nuevo.' });
    } finally {
      setNotificationsBusy(false);
    }
  };

  useEffect(() => {
    // Primero el armario del servidor; sin conexión, la copia local sincronizada
    wardrobeService.getWardrobe()
      .then(({ data }) => setGarmentCount(data.items.length))
      .catch(() => offlineSyncStorage.getSyncSnapshot().then((snapshot) => {
        const items = snapshot?.wardrobe?.items;
        setGarmentCount(Array.isArray(items) ? items.length : null);
      }).catch(() => setGarmentCount(null)));
  }, []);

  const loadPrivacyData = useCallback(async () => {
    setPrivacyLoading(true);
    setPrivacyError('');
    setPrivacySummary(null);
    try {
      const photos = await MediaVaultService.getAllItems();
      setLocalPhotos(photos);
      const [summary, consents] = await Promise.all([
        privacyService.getDataSummary(),
        privacyService.getConsents(),
      ]);
      setPrivacySummary(summary);
      const latestPhotoConsent = consents.find((consent) => consent.consentType === 'photo_analysis');
      setPhotoConsentActive(latestPhotoConsent?.accepted ?? false);
      const latestRetention = consents.find((consent) => consent.consentType === 'photo_retention');
      setRetentionActive(latestRetention?.accepted ?? false);
    } catch (error: any) {
      setPrivacyError(
        error?.response?.status === 401
          ? 'Tu sesión venció. Inicia sesión otra vez para consultar tus datos.'
          : 'No pudimos consultar tus datos. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setPrivacyLoading(false);
    }
  }, []);

  const handleOpenProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const [remote, local] = await Promise.all([profileService.getProfile(), getUserProfile()]);
      const stylePreferences = { ...emptyStylePreferences, ...remote.preferences.stylePreferences };
      const formValues: ProfileFormValues = {
        name: remote.name,
        email: remote.email,
        phone: remote.profile.phone || '',
        bio: remote.profile.bio || '',
        address: remote.profile.address || '',
        birthDate: remote.profile.birthDate || '',
        avatarUrl: remote.profile.avatarUrl || '',
        stylePreferences,
      };
      setProfileFormValues(formValues);
      await saveUserProfile({
        ...local,
        id: remote.id,
        name: remote.name,
        email: remote.email,
        goals: (stylePreferences.goals || local.goals) as UserProfile['goals'],
        preferredStyles: (stylePreferences.preferredStyles || local.preferredStyles) as UserProfile['preferredStyles'],
        dislikedStyles: (stylePreferences.dislikedStyles || local.dislikedStyles) as UserProfile['dislikedStyles'],
        occasions: (stylePreferences.occasions || local.occasions) as UserProfile['occasions'],
      });
      setShowEditProfile(true);
    } catch {
      notify({
        kind: 'error',
        message: 'No se pudo cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.',
      });
    } finally {
      setProfileLoading(false);
    }
  }, [notify]);

  const handleSaveProfile = useCallback(async (updated: ProfileFormValues) => {
    const profileInput = {
      name: updated.name,
      email: updated.email,
      bio: updated.bio,
      phone: updated.phone,
      address: updated.address,
      birthDate: updated.birthDate,
    };

    await profileService.updateProfile(profileInput);
    await profileService.updatePreferences(updated.stylePreferences);

    const local = await getUserProfile();
    const localSaved = await saveUserProfile({
      ...local,
      id: user?.id || local.id,
      name: updated.name,
      email: updated.email,
      goals: (updated.stylePreferences.goals || []) as UserProfile['goals'],
      preferredStyles: (updated.stylePreferences.preferredStyles || []) as UserProfile['preferredStyles'],
      dislikedStyles: (updated.stylePreferences.dislikedStyles || []) as UserProfile['dislikedStyles'],
      occasions: (updated.stylePreferences.occasions || []) as UserProfile['occasions'],
      isOnboarded: true,
    });
    if (!localSaved) {
      throw new Error('No se pudo actualizar el perfil guardado en el dispositivo.');
    }
    await updateUser({ name: updated.name, email: updated.email, phone: updated.phone, avatarUri: updated.avatarUrl });
    setProfileFormValues(updated);
    setShowEditProfile(false);
    notify({ kind: 'success', message: 'Guardamos tus cambios.' });
  }, [notify, updateUser, user?.id]);

  const handleUploadAvatar = useCallback(async (uri: string, fileName: string, mimeType: string) => {
    const avatarUrl = await profileService.uploadAvatar(uri, fileName, mimeType);
    await updateUser({ avatarUri: avatarUrl });
    setProfileFormValues((current) => ({ ...current, avatarUrl }));
    return avatarUrl;
  }, [updateUser]);

  const handleOpenPrivacy = useCallback(() => {
    setPrivacyActionError(null);
    setDeleteError('');
    setShowPrivacy(true);
    void loadPrivacyData();
  }, [loadPrivacyData]);

  const handleDownloadData = useCallback(async () => {
    try {
      setDownloading(true);
      setPrivacyActionError(null);
      await privacyService.downloadDataExport(localPhotos);
    } catch {
      setPrivacyActionError({
        title: 'No se pudo descargar',
        description: 'Revisa tu conexión e inténtalo de nuevo.',
        retryDownload: true,
      });
    } finally {
      setDownloading(false);
    }
  }, [localPhotos]);

  const handleDownloadPhoto = useCallback(async (photo: VaultItem) => {
    try {
      setPrivacyActionError(null);
      await privacyService.downloadLocalPhoto(photo);
    } catch {
      setPrivacyActionError({ title: 'No se pudo compartir la fotografía', description: 'Inténtalo de nuevo en unos segundos.' });
    }
  }, []);

  const handleTogglePhotoConsent = useCallback(async () => {
    try {
      setUpdatingConsent(true);
      setPrivacyActionError(null);
      const saved = await privacyService.recordPhotoAnalysisConsent(!photoConsentActive);
      setPhotoConsentActive(saved.accepted);
    } catch {
      setPrivacyActionError({ title: 'No se pudo guardar', description: 'No se actualizó la autorización. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setUpdatingConsent(false);
    }
  }, [photoConsentActive]);

  /** HU-034: conservar o no las fotos de análisis y simulaciones en la cuenta. */
  const handleToggleRetention = useCallback(async (next: boolean) => {
    setUpdatingRetention(true);
    setPrivacyActionError(null);
    try {
      await consentApi.set('photo_retention', next);
      setRetentionActive(next);
    } catch {
      setPrivacyActionError({ title: 'No se pudo guardar', description: 'No se cambió la opción de conservar tus fotos. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setUpdatingRetention(false);
    }
  }, []);

  const handleDeleteAccount = useCallback(async (password: string) => {
    try {
      setDeleting(true);
      setDeleteError('');
      await privacyService.deleteAccount(password);
      const cleanupResults = await Promise.allSettled([
        MediaVaultService.clearAllItems(),
        clearUserProfile(),
        offlineSyncStorage.clearPersonalData(),
        AuraMemoryService.clearMemory(),
        AuraGoalService.clearGoal(),
        clearWardrobeItems(),
      ]);
      await logout();
      setShowPrivacy(false);
      hapticFeedback.success();
      if (cleanupResults.some((result) => result.status === 'rejected')) {
        notify({
          kind: 'info',
          duration: 10000,
          message: 'Tu cuenta se eliminó, pero quedaron datos en este teléfono. Bórralos desde los ajustes del dispositivo (BellAI › Almacenamiento).',
        });
      }
    } catch (error: any) {
      setDeleteError(
        error?.response?.status === 401
          ? 'La contraseña no es correcta. No se eliminó ningún dato.'
          : 'No se completó el borrado. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setDeleting(false);
    }
  }, [logout, notify]);

  return (
    <View style={styles.container}>
      <CU04LogoutView
        user={user}
        notifications={{ enabled: notificationsOn, busy: notificationsBusy, onChange: (next) => void toggleNotifications(next) }}
        stats={{ garmentCount }}
        profileLoading={profileLoading}
        seasonLabel={currentDiagnostic?.season}
        onEditProfile={() => { void handleOpenProfile(); }}
        onViewDiagnostic={() => router.push('/studio')}
        onGoToPrivacy={handleOpenPrivacy}
        onViewStyle={() => router.push('/style' as any)}
        onViewChallenge={() => router.push('/weekly-challenge' as any)}
        onViewSavedOutfits={() => router.push('/saved-outfits' as any)}
        onViewHistory={() => router.push('/history' as any)}
        onReportProblem={() => router.push('/report' as any)}
        plan={planSummary}
        onViewPlan={() => router.push('/premium' as any)}
        onLogoutConfirm={async () => {
          hapticFeedback.medium();
          await logout();
        }}
      />

      <Modal visible={showEditProfile} animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        {showEditProfile ? (
          <CU07ProfilePreferencesView
            initialValues={profileFormValues}
            onBack={() => setShowEditProfile(false)}
            onSaveChanges={handleSaveProfile}
            onUploadAvatar={handleUploadAvatar}
          />
        ) : null}
        <NoticeOutlet />
      </Modal>

      <Modal visible={showPrivacy} animationType="slide" onRequestClose={() => setShowPrivacy(false)}>
        <CU11PrivacyDataView
          summary={privacySummary}
          localPhotos={localPhotos}
          loading={privacyLoading}
          loadingError={privacyError}
          consentActive={photoConsentActive}
          updatingConsent={updatingConsent}
          downloading={downloading}
          deleting={deleting}
          onBack={() => setShowPrivacy(false)}
          onRetry={() => { void loadPrivacyData(); }}
          onToggleConsent={() => { void handleTogglePhotoConsent(); }}
          retentionActive={retentionActive}
          updatingRetention={updatingRetention}
          onToggleRetention={(next) => { void handleToggleRetention(next); }}
          onDownloadData={handleDownloadData}
          onDownloadPhoto={handleDownloadPhoto}
          onDeleteDataConfirm={handleDeleteAccount}
          actionError={privacyActionError ? {
            ...privacyActionError,
            retry: privacyActionError.retryDownload ? () => { void handleDownloadData(); } : undefined,
          } : null}
          deleteError={deleteError}
        />
        <NoticeOutlet />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({ container: { flex: 1 } });
