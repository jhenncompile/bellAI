import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Garment, GarmentCategory } from '@/entities/wardrobe/model/types';
import { GarmentCard } from '@/entities/wardrobe/ui/GarmentCard';
import { Button, Card } from '@/shared/ui';
import { useTheme, typography, radius, spacing } from '@/shared/theme';
import { Camera, Shirt } from 'lucide-react-native';

interface WardrobeGridProps {
  items: Garment[];
  selectedCategory: GarmentCategory | 'Todos' | 'Todo';
  onSelectCategory: (category: any) => void;
  onScanGarment: () => void;
  isScanning?: boolean;
}

const CATEGORIES: (GarmentCategory | 'Todos')[] = [
  'Todos',
  'Superior',
  'Inferior',
  'Calzado',
  'Abrigo',
  'Accesorio',
];


export const WardrobeGrid: React.FC<WardrobeGridProps> = ({
  items,
  selectedCategory,
  onSelectCategory,
  onScanGarment,
  isScanning = false,
}) => {
  const { colors: theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Banner de Digitalización y Registro de Prenda */}
      <Card variant="glass" style={styles.scanBanner}>
        <View style={styles.scanTextContainer}>
          <Text style={[typography.h3, { color: theme.text.primary }]}>Armario Digital</Text>
          <Text style={[typography.small, { color: theme.text.secondary, marginTop: 2 }]}>
            Registra una prenda y confirma su armonía estacional
          </Text>
        </View>
        <Button
          title="Fotografiar"
          onPress={onScanGarment}
          variant="primary"
          size="sm"
          loading={isScanning}
          icon={<Camera color={theme.text.inverse} size={16} />}
        />
      </Card>

      {/* Selector de Categorías (Chips Penpot DS-04) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar armario por categoría ${cat}`}
              onPress={() => onSelectCategory(cat)}
              activeOpacity={0.8}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected
                    ? theme.ink[900]
                    : theme.surface.input,
                  borderColor: isSelected
                    ? theme.ink[900]
                    : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  typography.small,
                  {
                    color: isSelected ? theme.text.inverse : theme.ink[900],
                    fontWeight: isSelected ? '700' : '600',
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lista de Prendas */}
      <View style={styles.itemsList}>
        {items.length === 0 ? (
          <Card variant="glass" style={styles.emptyCard}>
            <Shirt color={theme.penpot?.ink[400] || theme.text.muted} size={36} />
            <Text style={[typography.h4, { color: theme.text.primary, marginTop: 10, textAlign: 'center' }]}>
              No hay prendas registradas en esta categoría
            </Text>
            <Text style={[typography.small, { color: theme.text.secondary, textAlign: 'center', marginTop: 4 }]}>
              Toma una fotografía de tu prenda para clasificarla y evaluar su armonía con tu paleta.
            </Text>
            <Button
              title="Fotografiar Primera Prenda"
              onPress={onScanGarment}
              variant="primary"
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : (
          items.map((garment) => (
            <GarmentCard key={garment.id} garment={garment} />
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
  },
  scanBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scanTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryScroll: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryChip: {
    height: 36, // Penpot DS-03 & DS-04 altura fija: 36 px
    paddingHorizontal: 16,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  itemsList: {
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});

