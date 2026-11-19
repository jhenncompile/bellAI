import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { VaultItem } from '@/entities/media-vault/model/types';
import { apiClient } from '@/shared/api/apiClient';

export interface PrivacyDataSummary {
  account: {
    name: string;
    email: string;
    memberSince: string;
  };
  profile: {
    bio: string;
    phone: string;
    address: string;
    birthDate: string;
    avatarUrl: string;
  };
  preferences: Record<string, unknown>;
  wardrobe: {
    itemCount: number;
    items: { name: string; category: string; addedAt: string }[];
  };
  photos: {
    wardrobeCount: number;
    mediaCount: number;
    totalCount: number;
  };
  consents: { recordCount: number };
  /** Datos del asistente guardados en la cuenta (HU-029). */
  analysis?: { diagnostics: number; storedPhotos: number; conversations: number; outfits: number; feedback: number; simulations: number };
}

export interface PrivacyConsent {
  id: string;
  consentType: string;
  accepted: boolean;
  policyVersion: string;
  createdAt: string;
}

export const PHOTO_ANALYSIS_CONSENT_TYPE = 'photo_analysis';

export class PhotoAnalysisConsentRequiredError extends Error {
  constructor() {
    super('Se requiere autorización vigente para analizar fotografías.');
    this.name = 'PhotoAnalysisConsentRequiredError';
  }
}

export const privacyService = {
  async getDataSummary(): Promise<PrivacyDataSummary> {
    const { data } = await apiClient.get<PrivacyDataSummary>('/privacy/data-summary');
    return data;
  },

  async getConsents(): Promise<PrivacyConsent[]> {
    const { data } = await apiClient.get<PrivacyConsent[]>('/privacy/consents');
    return data;
  },

  async getPhotoAnalysisConsent(): Promise<PrivacyConsent | null> {
    const consents = await this.getConsents();
    return (
      consents.find(
        (consent) => consent.consentType === PHOTO_ANALYSIS_CONSENT_TYPE,
      ) || null
    );
  },

  async assertPhotoAnalysisConsent(): Promise<void> {
    const currentConsent = await this.getPhotoAnalysisConsent();
    if (currentConsent?.accepted === true) return;
    throw new PhotoAnalysisConsentRequiredError();
  },

  async recordPhotoAnalysisConsent(accepted: boolean): Promise<PrivacyConsent> {
    const { data } = await apiClient.post<PrivacyConsent>('/privacy/consents', {
      consentType: PHOTO_ANALYSIS_CONSENT_TYPE,
      accepted,
      policyVersion: 'v1.0',
    });
    return data;
  },

  async deleteAccount(password: string): Promise<void> {
    await apiClient.post('/privacy/right-to-be-forgotten', { confirm: true, password });
  },

  async downloadDataExport(localPhotos: VaultItem[]): Promise<void> {
    const { data } = await apiClient.get<Record<string, unknown>>('/privacy/export');
    const exportData = {
      ...data,
      devicePhotos: localPhotos.map((photo) => ({
        fileName: photo.fileName,
        folder: photo.folder,
        capturedAt: photo.timestamp,
        summary: photo.summary,
        tags: photo.tags,
      })),
    };
    const fileName = `mis_datos_${new Date().toISOString().slice(0, 10)}.json`;
    const contents = JSON.stringify(exportData, null, 2);

    if (Platform.OS === 'web') {
      const blob = new Blob([contents], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    if (!FileSystem.cacheDirectory) {
      throw new Error('No se pudo preparar el archivo de exportación.');
    }

    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, contents);
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('No hay una aplicación disponible para guardar el archivo.');
    }
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Descargar mis datos',
    });
  },

  async downloadLocalPhoto(photo: VaultItem): Promise<void> {
    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      link.href = photo.localUri;
      link.download = photo.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('No hay una aplicación disponible para guardar esta fotografía.');
    }
    await Sharing.shareAsync(photo.localUri, { dialogTitle: 'Guardar fotografía' });
  },
};
