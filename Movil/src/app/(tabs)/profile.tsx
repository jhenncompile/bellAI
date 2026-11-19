import React from 'react';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { TabScene } from '@/views/TabScene';

export default function ProfilePage() {
  return (
    <TabScene name="profile">
      <ProfileScreen />
    </TabScene>
  );
}
