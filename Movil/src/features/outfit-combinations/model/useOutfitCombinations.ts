import { useEffect, useState, useCallback } from 'react';
import { outfitService } from '../api/outfitService';
import {
  OutfitSeason,
  OutfitOccasion,
  OutfitsResponse,
  GeneratedOutfit,
} from './outfit.types';
import { AuraMemoryService } from '@/entities/memory/model/auraMemoryService';
import { OutfitFeedbackVote } from '@/entities/memory/model/types';
import { hapticFeedback } from '@/shared/lib/haptics';
import { weatherService, WeatherData } from '@/features/weather/model/weatherService';
import { fetchWardrobeItems } from '@/features/wardrobe-matching/api/wardrobeService';
import { generateOfflineOutfits } from '@/features/wardrobe-matching/model/offlineOutfitMatcher';

export type OutfitLoadStatus = 'loading' | 'ready' | 'error';

/**
 * HU-19 / HU-20 / HU-23: Estado y lógica de la pantalla de combinaciones.
 *
 * - HU-19: Obtiene propuestas del backend con filtrado por temporada.
 * - HU-20: Considera la ocasión (trabajo, universidad, evento, etc.) y las condiciones climáticas del día.
 * - HU-20 Criterio 3: Si el clima no está disponible, genera combinaciones solo por ocasión e informa.
 * - HU-23: Ajusta las combinaciones según las valoraciones de la usuaria
 *   (penaliza lo negativo reduciendo su frecuencia y prioriza lo positivo).
 * - Permite valorar combinaciones en tiempo real (`voteOutfit`).
 */
export function useOutfitCombinations(limit = 6) {
  const [season, setSeasonState] = useState<OutfitSeason | undefined>(undefined);
  const [occasion, setOccasionState] = useState<OutfitOccasion>('todas');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<OutfitLoadStatus>('loading');
  const [data, setData] = useState<OutfitsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [votingOutfitId, setVotingOutfitId] = useState<string | null>(null);

  // Carga inicial del clima de la ubicación
  useEffect(() => {
    let active = true;
    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const w = await weatherService.getCurrentWeather();
        if (active) {
          setWeatherData(w);
        }
      } finally {
        if (active) setWeatherLoading(false);
      }
    };
    fetchWeather();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOutfits = async () => {
      try {
        // Cargar resumen de valoraciones previas para informar al generador (HU-23)
        const feedback = await AuraMemoryService.getFeedbackSummary();

        // Parámetros climáticos y de ocasión (HU-20)
        const weatherCondition = weatherData?.isAvailable
          ? weatherData.condition ?? undefined
          : undefined;
        const temperature =
          weatherData?.isAvailable && typeof weatherData.temperature === 'number'
            ? weatherData.temperature
            : undefined;

        const response = await outfitService.generateOutfits({
          season,
          occasion: occasion !== 'todas' ? occasion : undefined,
          weatherCondition,
          temperature,
          limit,
          likedGarmentIds: feedback.likedGarmentIds,
          dislikedGarmentIds: feedback.dislikedGarmentIds,
          likedColors: feedback.likedColors,
          dislikedColors: feedback.dislikedColors,
        });

        if (cancelled) return;

        // Ajustar localmente con memoria detallada para consistencia inmediata (HU-23)
        const adjustedOutfits = await AuraMemoryService.adjustOutfits(response.outfits);

        setData({
          ...response,
          outfits: adjustedOutfits,
        });
        setErrorMessage(null);
        setStatus('ready');
      } catch (err: any) {
        if (cancelled) return;

        // Sin servidor: combinaciones por armonía de color sobre el armario guardado en el dispositivo
        try {
          const localGarments = await fetchWardrobeItems();
          const offlineOutfits = generateOfflineOutfits(localGarments, {
            season,
            occasion: occasion !== 'todas' ? occasion : undefined,
            limit,
            cold: weatherData?.isAvailable ? weatherData.condition === 'frio' || weatherData.condition === 'lluvia' : undefined,
          });

          if (offlineOutfits.length > 0) {
            const adjustedOutfits = await AuraMemoryService.adjustOutfits(offlineOutfits);
            setData({
              isSufficient: true,
              insufficient: null,
              noMatches: null,
              summary: {
                totalConfirmed: localGarments.length,
                tops: localGarments.filter((g) => g.category === 'Superior').length,
                bottoms: localGarments.filter((g) => g.category === 'Inferior').length,
                onePieces: 0,
                shoes: localGarments.filter((g) => g.category === 'Calzado').length,
                outerwear: localGarments.filter((g) => g.category === 'Abrigo').length,
              },
              outfits: adjustedOutfits,
              generatedAt: new Date().toISOString(),
            });
            setErrorMessage(null);
            setStatus('ready');
            return;
          }
        } catch {
          // Ignorar fallo de fallback secundario y mostrar estado estructurado
        }

        setErrorMessage(
          err?.message || 'No pudimos armar tus combinaciones. Inténtalo de nuevo.'
        );
        setStatus('error');
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };

    loadOutfits();

    return () => {
      cancelled = true;
    };
  }, [season, occasion, weatherData, limit, reloadKey]);

  /** Cambia la temporada y muestra el estado de carga mientras llegan las nuevas combinaciones. */
  const setSeason = (next: OutfitSeason | undefined) => {
    if (next === season) return;
    setStatus('loading');
    setSeasonState(next);
  };

  /** Cambia la ocasión seleccionada (HU-20) */
  const setOccasion = (next: OutfitOccasion) => {
    if (next === occasion) return;
    setStatus('loading');
    setOccasionState(next);
  };

  /** Vuelve a pedir las combinaciones mostrando el esqueleto de carga. */
  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  /** Recarga desde el gesto de deslizar hacia abajo, refrescando también el clima. */
  const refresh = async () => {
    setRefreshing(true);
    try {
      const refreshedWeather = await weatherService.getCurrentWeather(true);
      setWeatherData(refreshedWeather);
    } catch {
      // Ignorar fallos de clima en refresco
    }
    setReloadKey((k) => k + 1);
  };

  /**
   * HU-22 / HU-23: Registra la valoración de una combinación y reorganiza
   * inmediatamente las propuestas en pantalla.
   */
  const voteOutfit = useCallback(
    async (outfit: GeneratedOutfit, vote: OutfitFeedbackVote) => {
      setVotingOutfitId(outfit.id);
      hapticFeedback.light();

      try {
        const topPiece = outfit.pieces.find(
          (p) => p.role === 'superior' || p.role === 'cuerpo_entero'
        );
        const bottomPiece = outfit.pieces.find((p) => p.role === 'inferior');

        await AuraMemoryService.recordFeedback(outfit.id, vote, {
          topId: topPiece?.item?.id,
          bottomId: bottomPiece?.item?.id,
          topHexColor: topPiece?.item?.colorHex || undefined,
          bottomHexColor: bottomPiece?.item?.colorHex || undefined,
        });

        // Reajustar en vivo la lista actual
        if (data?.outfits) {
          const updated = await AuraMemoryService.adjustOutfits(data.outfits);
          setData((prev) => (prev ? { ...prev, outfits: updated } : null));
        }
      } catch (e) {
        console.warn('[useOutfitCombinations] Error guardando valoración:', e);
      } finally {
        setVotingOutfitId(null);
      }
    },
    [data]
  );

  return {
    season,
    setSeason,
    occasion,
    setOccasion,
    weatherData,
    weatherLoading,
    status,
    data,
    errorMessage,
    refreshing,
    votingOutfitId,
    voteOutfit,
    retry,
    refresh,
  };
}
