import React from 'react';
import { HomeScreen } from '@/screens/HomeScreen';
import { TabScene } from '@/views/TabScene';

export default function IndexPage() {
  return (
    <TabScene name="index">
      <HomeScreen />
    </TabScene>
  );
}
