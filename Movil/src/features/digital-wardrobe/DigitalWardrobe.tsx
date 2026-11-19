import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { GarmentDetailScreen } from './screens/GarmentDetailScreen';
import { MyWardrobeScreen } from './screens/MyWardrobeScreen';
import { NewGarmentScreen } from './screens/NewGarmentScreen';
import { WardrobeHistoryScreen } from './screens/WardrobeHistoryScreen';
import { WardrobeItem } from './types/wardrobe.types';

export type DigitalWardrobeView = 'list' | 'new' | 'detail' | 'history';
type DigitalWardrobeNavigation =
  | { view: 'list' | 'new' | 'history'; selectedItem: null }
  | { view: 'detail'; selectedItem: WardrobeItem };

interface DigitalWardrobeProps {
  /** Notifica a la pantalla anfitriona la vista activa (para ocultar su encabezado en subpantallas). */
  onViewChange?: (view: DigitalWardrobeView) => void;
}

/**
 * Armario Digital (HU-009, HU-011 y HU-040): listado con filtros, alta de prenda por cámara/galería,
 * detalle con edición/eliminación/uso, e historial con respaldo y modo sin conexión.
 */
export const DigitalWardrobe: React.FC<DigitalWardrobeProps> = ({ onViewChange }) => {
  const [navigation, setNavigation] = useState<DigitalWardrobeNavigation>({
    view: 'list',
    selectedItem: null,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const go = useCallback(
    (next: 'list' | 'new' | 'history') => {
      setNavigation({ view: next, selectedItem: null });
      onViewChange?.(next);
    },
    [onViewChange],
  );

  const backToList = useCallback(() => {
    setNavigation({ view: 'list', selectedItem: null });
    setRefreshTrigger((current) => current + 1);
    onViewChange?.('list');
  }, [onViewChange]);

  return (
    <>
      <View style={{ display: navigation.view === 'list' ? 'flex' : 'none', width: '100%' }}>
        <MyWardrobeScreen
          refreshTrigger={refreshTrigger}
          onOpenNewGarment={() => go('new')}
          onOpenHistory={() => go('history')}
          onSelectGarment={(item) => {
            setNavigation({ view: 'detail', selectedItem: item });
            onViewChange?.('detail');
          }}
        />
      </View>

      {navigation.view === 'new' ? (
        <NewGarmentScreen onSavedSuccess={backToList} onCancel={backToList} />
      ) : null}

      {navigation.view === 'detail' ? (
        <GarmentDetailScreen
          item={navigation.selectedItem}
          onBack={backToList}
          onUpdated={(updated) => {
            setNavigation((current) =>
              current.view === 'detail' ? { ...current, selectedItem: updated } : current,
            );
          }}
          onDeleted={backToList}
        />
      ) : null}

      {navigation.view === 'history' ? (
        <WardrobeHistoryScreen onBack={backToList} />
      ) : null}
    </>
  );
};
