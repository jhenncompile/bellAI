import React from 'react';
import { StudioScreen } from '@/screens/StudioScreen';
import { TabScene } from '@/views/TabScene';

export default function StudioPage() {
  return (
    <TabScene name="studio">
      <StudioScreen />
    </TabScene>
  );
}
