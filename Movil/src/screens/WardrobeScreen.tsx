import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CU20WardrobeView,
  CU18GarmentCameraView,
  CU19ConfirmGarmentView,
  CU21GarmentDetailView,
  CU22OutfitCombinationsView,
  CU24EvaluateStoreItemView,
  GarmentItem,
} from '@/views';
import type { ConfirmedGarmentData } from '@/views/CU19ConfirmGarmentView';
import { wardrobeService } from '@/features/digital-wardrobe/services/wardrobeService';
import { GarmentAnalysisResult } from '@/features/digital-wardrobe/services/garmentImageAnalyzer';
import { offlineSyncStorage } from '@/features/digital-wardrobe/storage/offlineSyncStorage';
import { EnvConfig } from '@/features/digital-wardrobe/config/env';
import {
  OCCASION_LABELS,
  SUBCATEGORY_LABELS,
  StoreGarmentEvaluationResponse,
  WardrobeItem,
} from '@/features/digital-wardrobe/types/wardrobe.types';
import { friendlyMessage } from '@/shared/api/http';
import { useNotice } from '@/shared/ui';
import { hapticFeedback } from '@/shared/lib/haptics';
import { NoticeOutlet } from '@/shared/ui/Notice';

function toGarmentItem(item: WardrobeItem): GarmentItem {
  const [groupLabel, subLabel] = (item.bottomDetails.categoryLabel || '').split(' • ');
  const occasion = item.bottomDetails.occasion;
  return {
    id: item.id,
    name: item.name,
    category: groupLabel || item.category,
    color: item.bottomDetails.color,
    size: item.bottomDetails.approximateSize,
    photoUri:
      item.localPhotoUri ||
      EnvConfig.resolveImageUrl(item.enhancedImageUrl || item.originalImageUrl),
    timesWorn: item.usageStats.wearCount,
    occasion: occasion ? OCCASION_LABELS[occasion] ?? occasion : undefined,
    categoryKey: item.category,
    subcategory: item.subcategory,
    subcategoryLabel: subLabel || SUBCATEGORY_LABELS[item.subcategory],
    colorHex: item.bottomDetails.colorHex || null,
    canWear: item.actions?.canWear !== false && !item.id.startsWith('local-draft-'),
  };
}

export const WardrobeScreen: React.FC = () => {
  const { notify } = useNotice();
  const router = useRouter();

  const [showCamera, setShowCamera] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<GarmentItem | null>(null);
  // Si hay una prenda en edición, CU-19 actualiza esa prenda en lugar de crear otra
  const [editingGarment, setEditingGarment] = useState<GarmentItem | null>(null);

  // Análisis de la foto recién tomada
  const [currentAnalysis, setCurrentAnalysis] = useState<GarmentAnalysisResult | null>(null);
  const [captureSource, setCaptureSource] = useState<'camera' | 'gallery'>('camera');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Acciones del detalle
  const [wearing, setWearing] = useState(false);
  const [wornToday, setWornToday] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailError, setDetailError] = useState('');

  // CU-22 (combinaciones) y CU-24 (evaluar en tienda)
  const [showOutfitsModal, setShowOutfitsModal] = useState(false);
  const [showStoreEvaluationModal, setShowStoreEvaluationModal] = useState(false);

  const [garments, setGarments] = useState<GarmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [offline, setOffline] = useState(false);

  const loadGarments = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setOffline(false);
    try {
      const { data } = await wardrobeService.getWardrobe();
      setGarments(data.items.map(toGarmentItem));
    } catch (error) {
      // Sesión caducada: AuthContext ya lleva al inicio de sesión; no es un fallo de conexión
      if ((error as { statusCode?: number })?.statusCode === 401) return;
      try {
        const localDrafts = await offlineSyncStorage.getLocalOfflineDrafts();
        setGarments(localDrafts.map(toGarmentItem));
        if (localDrafts.length > 0) { setOffline(true); return; }
        console.error('[WardrobeScreen] No se pudo cargar el armario:', error);
        setLoadError('Revisa tu conexión y vuelve a intentarlo.');
      } catch (storageError) {
        console.error('[WardrobeScreen] No se pudo cargar el respaldo local:', storageError);
        setLoadError('No pudimos abrir las prendas guardadas. Vuelve a intentarlo.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadGarments);
  }, [loadGarments]);

  const replaceGarment = (updated: GarmentItem) => {
    setGarments((current) => current.map((g) => (g.id === updated.id ? updated : g)));
    setSelectedGarment((current) => (current?.id === updated.id ? updated : current));
  };

  const handleAddNewGarment = () => {
    setEditingGarment(null);
    setShowCamera(true);
  };

  const handleCaptureGarment = (analysis: GarmentAnalysisResult, source: 'camera' | 'gallery' = 'camera') => {
    hapticFeedback.heavy();
    setCurrentAnalysis(analysis);
    setCaptureSource(source);
    setSaveError('');
    setShowCamera(false);
    setShowConfirmModal(true);
  };

  const closeConfirm = () => {
    if (saving) return;
    setShowConfirmModal(false);
    setEditingGarment(null);
    setSaveError('');
  };

  const handleSaveGarment = async (data: ConfirmedGarmentData) => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      if (editingGarment) {
        // El servicio de edición no recibe `colorHex`: se conserva el que tenía la prenda
        const response = await wardrobeService.updateGarment(editingGarment.id, {
          name: data.name,
          category: data.category,
          subcategory: data.subcategory,
          color: data.color,
        });
        replaceGarment(toGarmentItem(response.item));
        setEditingGarment(null);
        setShowConfirmModal(false);
        hapticFeedback.success();
        notify({ kind: 'success', message: 'Guardamos los cambios de tu prenda.' });
        return;
      }
      const response = await wardrobeService.scanAndSaveGarment({
        photoUri: data.photoUri || null,
        name: data.name,
        category: data.category,
        subcategory: data.subcategory,
        color: data.color,
        colorHex: data.colorHex,
        captureSource,
      });
      const savedGarment = toGarmentItem(response.item);
      setGarments((current) => [savedGarment, ...current.filter((g) => g.id !== savedGarment.id)]);
      setShowConfirmModal(false);
      setCurrentAnalysis(null);
      hapticFeedback.success();
      notify(
        response.savedAsDraft
          ? { kind: 'offline', message: 'Guardamos la prenda en este teléfono. Se subirá cuando vuelva la conexión.' }
          : { kind: 'success', message: 'Prenda guardada en tu armario.' },
      );
    } catch (error) {
      console.error('[WardrobeScreen] No se pudo guardar la prenda:', error);
      hapticFeedback.warning();
      setSaveError(friendlyMessage(error, 'Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectGarment = (garment: GarmentItem) => {
    setDetailError('');
    setWornToday(false);
    setSelectedGarment(garment);
  };

  const closeDetail = () => {
    if (deleting) return;
    setSelectedGarment(null);
  };

  const handleMarkWorn = async () => {
    if (!selectedGarment || wearing) return;
    setWearing(true);
    setDetailError('');
    try {
      const response = await wardrobeService.recordGarmentWear(selectedGarment.id);
      replaceGarment(toGarmentItem(response.item));
      setWornToday(true);
      hapticFeedback.success();
    } catch (error) {
      hapticFeedback.warning();
      setDetailError(friendlyMessage(error, 'No pudimos anotar el uso. Inténtalo de nuevo.'));
    } finally {
      setWearing(false);
    }
  };

  const handleDeleteGarment = async () => {
    if (!selectedGarment || deleting) return;
    const garment = selectedGarment;
    setDeleting(true);
    setDetailError('');
    try {
      await wardrobeService.deleteGarment(garment.id, garment.name);
      setGarments((current) => current.filter((g) => g.id !== garment.id));
      setSelectedGarment(null);
      hapticFeedback.success();
      notify({ kind: 'success', message: `Eliminamos «${garment.name}» de tu armario.` });
    } catch (error) {
      hapticFeedback.warning();
      setDetailError(friendlyMessage(error, 'No pudimos eliminar la prenda. Inténtalo de nuevo.'));
    } finally {
      setDeleting(false);
    }
  };

  // Abre la cámara de prenda desde CU-22 (armario insuficiente): se cierra CU-22 para no apilar modales
  const handleAddFromOutfits = () => {
    setShowOutfitsModal(false);
    handleAddNewGarment();
  };

  // CU-24: guarda en el armario la prenda evaluada en tienda
  const handleSaveStoreGarment = async (
    evaluation: StoreGarmentEvaluationResponse,
    photoUri: string | null,
  ) => {
    try {
      const response = await wardrobeService.scanAndSaveGarment({
        photoUri: photoUri || null,
        name: `Prenda evaluada (${evaluation.colorAnalysis.colorEvaluated})`,
        category: 'superior',
        subcategory: 'blusas',
        color: evaluation.colorAnalysis.colorEvaluated,
        captureSource: 'camera',
      });
      const savedGarment = toGarmentItem(response.item);
      setGarments((current) => [savedGarment, ...current.filter((g) => g.id !== savedGarment.id)]);
      setShowStoreEvaluationModal(false);
      hapticFeedback.success();
      notify(
        response.savedAsDraft
          ? { kind: 'offline', message: 'Guardamos la prenda en este teléfono. Se subirá cuando vuelva la conexión.' }
          : { kind: 'success', message: 'Prenda agregada a tu armario.' },
      );
    } catch (error) {
      // Antes se avisaba «Prenda guardada» aunque fallara: ahora se informa el error y CU-24 sigue abierta
      console.error('[WardrobeScreen] No se pudo guardar la prenda evaluada:', error);
      hapticFeedback.warning();
      notify({ kind: 'error', message: friendlyMessage(error, 'No pudimos agregar la prenda. Inténtalo de nuevo.') });
    }
  };

  const handleEditGarment = () => {
    if (!selectedGarment) return;
    setEditingGarment(selectedGarment);
    setCurrentAnalysis(null);
    setSaveError('');
    setSelectedGarment(null);
    setShowConfirmModal(true);
  };

  return (
    <View style={styles.container}>
      {/* CU-20 · Consultar y filtrar mi armario */}
      <CU20WardrobeView
        garments={garments}
        loading={loading}
        error={loadError}
        offline={offline}
        onRetry={() => { void loadGarments(); }}
        onAddNewGarment={handleAddNewGarment}
        onSelectGarment={handleSelectGarment}
        onOpenOutfits={() => setShowOutfitsModal(true)}
        onEvaluateStoreItem={() => setShowStoreEvaluationModal(true)}
      />

      {/* CU-18 · Registrar una prenda con fotografía */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <CU18GarmentCameraView onBack={() => setShowCamera(false)} onCaptureGarment={handleCaptureGarment} />
        <NoticeOutlet />
      </Modal>

      {/* CU-19 · Confirmar tipo y color (o editar una prenda) */}
      <Modal visible={showConfirmModal} animationType="slide" onRequestClose={closeConfirm}>
        <CU19ConfirmGarmentView
          key={editingGarment?.id ?? currentAnalysis?.photoUri ?? 'nueva'}
          mode={editingGarment ? 'edit' : 'create'}
          analysis={editingGarment ? null : currentAnalysis}
          photoUri={editingGarment ? editingGarment.photoUri || undefined : currentAnalysis?.photoUri}
          initialValues={
            editingGarment
              ? {
                  name: editingGarment.name,
                  subcategory: editingGarment.subcategory,
                  color: editingGarment.color,
                  colorHex: editingGarment.colorHex,
                }
              : null
          }
          saving={saving}
          errorMessage={saveError}
          onBack={closeConfirm}
          onSaveGarment={(data) => { void handleSaveGarment(data); }}
        />
        <NoticeOutlet />
      </Modal>

      {/* CU-21 · Detalle: usar, editar o eliminar una prenda */}
      <Modal visible={Boolean(selectedGarment)} animationType="slide" onRequestClose={closeDetail}>
        {selectedGarment ? (
          <CU21GarmentDetailView
            garmentName={selectedGarment.name}
            category={selectedGarment.subcategoryLabel || selectedGarment.category}
            color={selectedGarment.color}
            colorHex={selectedGarment.colorHex}
            occasion={selectedGarment.occasion}
            timesWorn={selectedGarment.timesWorn}
            photoUri={selectedGarment.photoUri}
            canWear={selectedGarment.canWear}
            wornToday={wornToday}
            wearing={wearing}
            deleting={deleting}
            errorMessage={detailError}
            onBack={closeDetail}
            onMarkWorn={() => { void handleMarkWorn(); }}
            onEditGarment={handleEditGarment}
            onDeleteConfirm={() => { void handleDeleteGarment(); }}
          />
        ) : null}
        <NoticeOutlet />
      </Modal>

      {/* CU-22 · Combinaciones con mis prendas (HU-19/20/23) */}
      <Modal visible={showOutfitsModal} animationType="slide" onRequestClose={() => setShowOutfitsModal(false)}>
        <CU22OutfitCombinationsView
          onBack={() => setShowOutfitsModal(false)}
          onAddGarment={handleAddFromOutfits}
          // HU-22: la lista de guardadas es otra pantalla: se cierra el modal para que quede encima
          onOpenSaved={() => { setShowOutfitsModal(false); router.push('/saved-outfits' as never); }}
        />
        <NoticeOutlet />
      </Modal>

      {/* CU-24 · Evaluar una prenda en tienda (HU-24) */}
      <Modal
        visible={showStoreEvaluationModal}
        animationType="slide"
        onRequestClose={() => setShowStoreEvaluationModal(false)}
      >
        <CU24EvaluateStoreItemView
          onBack={() => setShowStoreEvaluationModal(false)}
          onSaveToWardrobe={handleSaveStoreGarment}
        />
        <NoticeOutlet />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
