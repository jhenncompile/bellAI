import React from 'react';
import { WardrobeScreen } from '@/screens/WardrobeScreen';
import { TabScene } from '@/views/TabScene';

export default function WardrobePage() {
  return (
    <TabScene name="wardrobe">
      <WardrobeScreen />
    </TabScene>
  );
}
