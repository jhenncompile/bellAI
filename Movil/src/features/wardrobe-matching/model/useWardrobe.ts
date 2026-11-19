import { useState, useEffect, useMemo } from 'react';
import { Garment, GarmentCategory } from '@/entities/wardrobe/model/types';
import { fetchWardrobeItems, scanNewGarment } from '../api/wardrobeService';
import { hapticFeedback } from '@/shared/lib/haptics';

export const useWardrobe = () => {
  const [items, setItems] = useState<Garment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<GarmentCategory | 'Todos'>('Todos');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWardrobeItems();
      setItems(data);
    } finally {
      setIsLoading(false);
    }
  };

  const addGarment = async (
    imageUri: string,
    category: GarmentCategory = 'Superior',
    garmentName?: string,
    userUndertone?: any
  ) => {
    setIsLoading(true);
    hapticFeedback.medium();
    try {
      const newGarment = await scanNewGarment(imageUri, category, garmentName, userUndertone);
      setItems((prev) => [newGarment, ...prev]);
      hapticFeedback.success();
      return newGarment;
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'Todos') return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  return {
    items: filteredItems,
    allItemsCount: items.length,
    selectedCategory,
    setSelectedCategory,
    isLoading,
    addGarment,
    refresh: loadItems,
  };
};
