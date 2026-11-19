import React from 'react';
import { ChatAdvisorScreen } from '@/screens/ChatAdvisorScreen';
import { TabScene } from '@/views/TabScene';

export default function AdvisorPage() {
  return (
    <TabScene name="advisor">
      <ChatAdvisorScreen />
    </TabScene>
  );
}
