import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { House, ScanFace, Shirt, UserRound, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/theme';
import FloatingTabBar from './FloatingTabBar';

const destinations = [
  { name: 'index', title: 'Inicio', icon: House },
  { name: 'wardrobe', title: 'Armario', icon: Shirt },
  { name: 'studio', title: 'Mi análisis', icon: ScanFace },
  { name: 'advisor', title: 'Asistente', icon: MessageCircle },
  { name: 'profile', title: 'Perfil', icon: UserRound },
];

/** Los mismos destinos y etiquetas en móvil y web, con la barra flotante del rediseño. */
export default function PrimaryTabs() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background.primary } }}
    >
      {destinations.map(({ name, title, icon: Icon }) => (
        <Tabs.Screen key={name} name={name} options={{
          title, tabBarAccessibilityLabel: title,
          tabBarIcon: ({ color, focused }) => <Icon size={22} color={color} strokeWidth={focused ? 3.2 : 3} />,
        }} />
      ))}
    </Tabs>
  );
}
