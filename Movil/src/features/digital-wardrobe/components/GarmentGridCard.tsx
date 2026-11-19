import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EnvConfig } from '../config/env';
import {
  SUBCATEGORY_LABELS,
  WardrobeItem,
} from '../types/wardrobe.types';
import { atelierRadii, atelierShadows, useAtelierPalette, AtelierPalette } from '../theme/atelierTheme';

interface GarmentGridCardProps {
  item: WardrobeItem;
  onPress: (item: WardrobeItem) => void;
}

/**
 * Tarjeta de prenda para la cuadrícula de "Mi Armario" (HU-011 y HU-009).
 * Presenta la imagen mejorada realista sobre marco Crema Seda (`#F3ECE3`)
 * y en la parte inferior detalla el nombre, color (con punto `colorHex`) y talla aproximada.
 */
export const GarmentGridCard: React.FC<GarmentGridCardProps> = ({ item, onPress }) => {
  const atelierColors = useAtelierPalette();
  const styles = useMemo(() => createStyles(atelierColors), [atelierColors]);
  const resolvedImageUrl =
    item.localPhotoUri ||
    EnvConfig.resolveImageUrl(item.enhancedImageUrl || item.originalImageUrl);

  const isDraft = item.status !== 'confirmed';
  const subcategoryLabel =
    SUBCATEGORY_LABELS[item.subcategory] || item.bottomDetails.categoryLabel;

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() => onPress(item)}
      style={styles.card}
    >
      {/* Marco de Estudio Fotográfico */}
      <View style={styles.studioFrame}>
        {resolvedImageUrl ? (
          <Image
            source={{ uri: resolvedImageUrl }}
            style={styles.garmentImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderBox}>
            <View
              style={[
                styles.placeholderSwatch,
                { backgroundColor: item.bottomDetails?.colorHex || atelierColors.terracotta },
              ]}
            />
            <Text style={styles.placeholderText}>Sin foto aún</Text>
          </View>
        )}

        {/* Etiqueta superior de subcategoría (ej. Blusas, Vestidos, Pantalones) */}
        <View style={styles.subcategoryBadge}>
          <Text style={styles.subcategoryBadgeText}>{subcategoryLabel}</Text>
        </View>

        {/* Indicador si es un borrador conservado (HU-009) */}
        {isDraft ? (
          <View style={styles.draftBadge}>
            <Text style={styles.draftBadgeText}>
              {item.status === 'upload_failed' ? 'Foto pendiente' : 'Borrador'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Detalles importantes en la parte inferior de la tarjeta */}
      <Text numberOfLines={1} style={styles.garmentName}>
        {item.name}
      </Text>

      <View style={styles.bottomDetailsRow}>
        <View style={styles.colorRow}>
          <View
            style={[
              styles.colorDot,
              { backgroundColor: item.bottomDetails?.colorHex || '#CBD5E1' },
            ]}
          />
          <Text numberOfLines={1} style={styles.colorText}>
            {item.bottomDetails?.color || 'Por definir'}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.sizeText}>
          {item.bottomDetails?.approximateSize?.replace(' (Aprox.)', '') || 'Talla M'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (atelierColors: AtelierPalette) => StyleSheet.create({
  card: {
    width: '48.2%',
    backgroundColor: atelierColors.surfaceWhite,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    borderRadius: atelierRadii.lg,
    padding: 9,
    marginBottom: 13,
    ...atelierShadows.softCard,
  },
  studioFrame: {
    height: 162,
    borderRadius: atelierRadii.md,
    backgroundColor: atelierColors.bgSilk,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  garmentImage: {
    width: '100%',
    height: '100%',
  },
  placeholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  placeholderSwatch: {
    width: 48,
    height: 60,
    borderRadius: 12,
    marginBottom: 6,
    opacity: 0.85,
  },
  placeholderText: {
    fontSize: 11,
    color: atelierColors.mocha,
    fontWeight: '600',
  },
  subcategoryBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: atelierRadii.pill,
    borderWidth: 1,
    borderColor: atelierColors.bgSand,
  },
  subcategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: atelierColors.mocha,
  },
  draftBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: atelierColors.amberLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: atelierRadii.pill,
    borderWidth: 1,
    borderColor: atelierColors.amberBorder,
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: atelierColors.amber,
  },
  garmentName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: atelierColors.espresso,
    marginBottom: 4,
  },
  bottomDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
    borderWidth: 1,
    borderColor: 'rgba(44, 34, 30, 0.15)',
  },
  colorText: {
    fontSize: 11.5,
    color: atelierColors.mocha,
    flex: 1,
  },
  sizeText: {
    fontSize: 11,
    fontWeight: '700',
    color: atelierColors.terracottaDark,
    backgroundColor: atelierColors.roseBlush,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: atelierRadii.pill,
  },
});
