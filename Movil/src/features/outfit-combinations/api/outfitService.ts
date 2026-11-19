import { apiClient } from '@/shared/api/apiClient';
import { OutfitQuery, OutfitsResponse } from '../model/outfit.types';

export const outfitService = {
  /**
   * HU-19 / HU-23: Combinaciones generadas sólo con las prendas confirmadas del armario
   * y ajustadas según las valoraciones previas de la usuaria (GET /api/wardrobe/outfits).
   * Requiere sesión iniciada.
   */
  async generateOutfits(query: OutfitQuery = {}): Promise<OutfitsResponse> {
    const params: Record<string, any> = {};

    if (query.season) params.season = query.season;
    if (query.limit) params.limit = query.limit;
    if (query.occasion && query.occasion !== 'todas') params.occasion = query.occasion;
    if (query.weatherCondition) params.weatherCondition = query.weatherCondition;
    if (typeof query.temperature === 'number') params.temperature = query.temperature;

    if (query.likedGarmentIds && query.likedGarmentIds.length > 0) {
      params.likedGarmentIds = query.likedGarmentIds.join(',');
    }
    if (query.dislikedGarmentIds && query.dislikedGarmentIds.length > 0) {
      params.dislikedGarmentIds = query.dislikedGarmentIds.join(',');
    }
    if (query.likedColors && query.likedColors.length > 0) {
      params.likedColors = query.likedColors.join(',');
    }
    if (query.dislikedColors && query.dislikedColors.length > 0) {
      params.dislikedColors = query.dislikedColors.join(',');
    }

    const response = await apiClient.get<OutfitsResponse>('/wardrobe/outfits', {
      params,
    });
    return response.data;
  },
};
