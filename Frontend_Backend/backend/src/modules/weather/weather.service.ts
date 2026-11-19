import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

export interface WeatherSnapshot {
  source: 'open-meteo' | 'manual';
  temperatureC: number;
  minC?: number;
  maxC?: number;
  precipitationMm: number;
  rainProbability: number | null;
  windKmh: number | null;
  code: number | null;
  summary: string;
  condition: 'frio' | 'templado' | 'calor';
  rainy: boolean;
  location?: { latitude: number; longitude: number };
  fetchedAt: string;
}

const WMO: Record<number, string> = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa', 61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa',
  71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa', 80: 'Chubascos', 81: 'Chubascos fuertes', 82: 'Chubascos violentos',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo',
};

export function classifyTemperature(t: number): WeatherSnapshot['condition'] {
  if (t < 15) return 'frio';
  if (t >= 25) return 'calor';
  return 'templado';
}

/**
 * HU-038: información climática para las recomendaciones de outfits (servicio externo del modelo de contexto).
 * Privacidad: las coordenadas se redondean a 1 decimal (~11 km) antes de salir del servidor.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly apiUrl: string;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache, config: ConfigService) {
    this.apiUrl = config.get<string>('WEATHER_API_URL') || 'https://api.open-meteo.com/v1/forecast';
  }

  manual(temperatureC: number, rainy = false): WeatherSnapshot {
    if (!Number.isFinite(temperatureC) || temperatureC < -40 || temperatureC > 55) throw new BadRequestException('Temperatura no válida.');
    return {
      source: 'manual', temperatureC, precipitationMm: rainy ? 1 : 0, rainProbability: rainy ? 100 : 0, windKmh: null, code: null,
      summary: rainy ? 'Lluvia (indicada por ti)' : `${temperatureC} °C (indicado por ti)`,
      condition: classifyTemperature(temperatureC), rainy, fetchedAt: new Date().toISOString(),
    };
  }

  async current(latitude: number, longitude: number): Promise<WeatherSnapshot> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new BadRequestException('Coordenadas no válidas.');
    }
    const lat = Math.round(latitude * 10) / 10;
    const lon = Math.round(longitude * 10) / 10;
    const key = `weather:${lat}:${lon}`;
    const cached = await this.cache.get<WeatherSnapshot>(key);
    if (cached) return cached;
    const url = `${this.apiUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: any = await res.json();
      const c = data.current || {};
      const code = typeof c.weather_code === 'number' ? c.weather_code : null;
      const rainProb = data.daily?.precipitation_probability_max?.[0] ?? null;
      const precipitation = Number(c.precipitation || 0);
      const temperature = Number(c.temperature_2m);
      const snap: WeatherSnapshot = {
        source: 'open-meteo',
        temperatureC: temperature,
        minC: data.daily?.temperature_2m_min?.[0],
        maxC: data.daily?.temperature_2m_max?.[0],
        precipitationMm: precipitation,
        rainProbability: rainProb,
        windKmh: c.wind_speed_10m ?? null,
        code,
        summary: `${code !== null ? WMO[code] ?? 'Variable' : 'Variable'}, ${Math.round(temperature)} °C`,
        condition: classifyTemperature(temperature),
        rainy: precipitation > 0.2 || (rainProb ?? 0) >= 60 || (code !== null && code >= 51 && code <= 82),
        location: { latitude: lat, longitude: lon },
        fetchedAt: new Date().toISOString(),
      };
      await this.cache.set(key, snap, 30 * 60 * 1000);
      return snap;
    } catch (err: any) {
      this.logger.warn(`Clima no disponible: ${err?.message}`);
      throw new BadRequestException('No pudimos obtener el clima ahora. Indica la temperatura manualmente.');
    } finally {
      clearTimeout(timer);
    }
  }
}
