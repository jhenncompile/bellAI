import * as Location from 'expo-location';

/**
 * HU-038: ubicación aproximada para el clima. Se pide solo al generar outfits y el
 * backend redondea las coordenadas antes de consultar el servicio climático.
 */
export async function approximateLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return { latitude: Math.round(pos.coords.latitude * 100) / 100, longitude: Math.round(pos.coords.longitude * 100) / 100 };
  } catch {
    return null;
  }
}
