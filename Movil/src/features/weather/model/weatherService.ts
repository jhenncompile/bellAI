import { OutfitWeatherCondition } from '@/features/outfit-combinations/model/outfit.types';

export interface WeatherData {
  isAvailable: boolean;
  temperature: number | null;
  condition: OutfitWeatherCondition | null;
  conditionLabel: string | null;
  locationName: string | null;
  weatherNotice?: string | null;
}

let cachedWeather: { data: WeatherData; timestamp: number } | null = null;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutos en memoria

const WEATHER_LABELS: Record<OutfitWeatherCondition, string> = {
  frio: 'Clima frío',
  templado: 'Clima templado',
  calido: 'Clima cálido',
  lluvia: 'Día lluvioso',
};

export const weatherService = {
  /**
   * HU-20: Obtiene el clima del día de la ubicación de la usuaria.
   * Si el servicio no está disponible o supera los 2.5s, devuelve `isAvailable: false`
   * y un aviso informativo para cumplir con el Criterio 3 de HU-20.
   */
  async getCurrentWeather(forceRefresh = false): Promise<WeatherData> {
    if (
      !forceRefresh &&
      cachedWeather &&
      Date.now() - cachedWeather.timestamp < CACHE_DURATION_MS
    ) {
      return cachedWeather.data;
    }

    const fallbackUnavailable: WeatherData = {
      isAvailable: false,
      temperature: null,
      condition: null,
      conditionLabel: null,
      locationName: null,
      weatherNotice:
        'Información climática no disponible. Se generaron combinaciones solo por la ocasión seleccionada.',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      // 1. Geolocalización por IP ligera sin API key ni permisos invasivos
      const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json', {
        signal: controller.signal,
      });
      if (!geoRes.ok) throw new Error('Geo lookup failed');
      const geo = await geoRes.json();

      const lat = parseFloat(geo.latitude);
      const lon = parseFloat(geo.longitude);
      const locationName = geo.city || geo.country || 'Tu ubicación';

      if (isNaN(lat) || isNaN(lon)) throw new Error('Invalid coordinates');

      // 2. Open-Meteo API pública y gratuita
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const weatherRes = await fetch(weatherUrl, { signal: controller.signal });
      if (!weatherRes.ok) throw new Error('Weather lookup failed');
      const weatherJson = await weatherRes.json();

      const temp = weatherJson?.current?.temperature_2m;
      const code = weatherJson?.current?.weather_code ?? 0;

      if (typeof temp !== 'number') throw new Error('Temperature missing');

      // Mapeo WMO weather code a condición
      // Códigos 51..67, 80..82, 95..99 = llovizna, lluvia, chubascos, tormenta
      const isRain =
        (code >= 51 && code <= 67) ||
        (code >= 80 && code <= 82) ||
        (code >= 95 && code <= 99);
      // Códigos 71..77, 85..86 = nieve
      const isSnow = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);

      let condition: OutfitWeatherCondition;
      if (isRain) {
        condition = 'lluvia';
      } else if (isSnow || temp < 15) {
        condition = 'frio';
      } else if (temp > 23) {
        condition = 'calido';
      } else {
        condition = 'templado';
      }

      const result: WeatherData = {
        isAvailable: true,
        temperature: Math.round(temp),
        condition,
        conditionLabel: WEATHER_LABELS[condition],
        locationName,
        weatherNotice: null,
      };

      cachedWeather = { data: result, timestamp: Date.now() };
      return result;
    } catch {
      // Si la red no responde o supera el tiempo límite, se devuelve el estado no disponible
      return fallbackUnavailable;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  clearCache() {
    cachedWeather = null;
  },
};

