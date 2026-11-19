import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { setPlanLimitHandler } from '@/shared/api/planLimit';

/**
 * Cuando el backend responde 402 `PLAN_LIMIT` (tope del plan), ofrece la pantalla Premium.
 * Va dentro de la sesión iniciada; no dibuja nada.
 */
export function PlanLimitGate() {
  const open = useRef(false);

  useEffect(() => {
    setPlanLimitHandler((info) => {
      if (open.current) return; // varias peticiones a la vez: un solo aviso
      open.current = true;
      Alert.alert('Llegaste al límite de tu plan', info.message, [
        { text: 'Ahora no', style: 'cancel', onPress: () => { open.current = false; } },
        { text: 'Ver Premium', onPress: () => { open.current = false; router.push('/premium' as any); } },
      ], { cancelable: true, onDismiss: () => { open.current = false; } });
    });
    return () => setPlanLimitHandler(null);
  }, []);

  return null;
}
