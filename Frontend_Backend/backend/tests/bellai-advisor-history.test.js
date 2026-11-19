const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BellaiRecommendationReasoner,
} = require('../dist/modules/bellai/bellai-recommendation.reasoner');

test('HU-18: genera motivo con datos reales de colorimetria, rostro, armario y estilo', () => {
  const reasoner = new BellaiRecommendationReasoner();
  const explanation = reasoner.explain(
    {
      userId: 'u-1',
      userName: 'Valeria',
      preferences: {
        goals: ['Vestirme mejor'],
        preferredStyles: ['Quiet Luxury'],
        dislikedStyles: [],
        occasions: ['Trabajo / Oficina'],
        preferredColors: ['terracota'],
        avoidedColors: [],
        budgetPerGarment: null,
      },
      diagnostic: {
        id: 'd-1',
        faceShape: 'Ovalado',
        skinTone: 'Medio cálido',
        undertone: 'Calido',
        seasonalPalette: 'Otoño Cálido',
        contrastLevel: 'Medio',
        recommendedPalette: ['Terracota', 'Oliva'],
        toxicColors: ['Azul frío'],
        hairAdvice: {},
        createdAt: new Date(),
      },
      wardrobe: {
        totalItems: 2,
        colors: ['terracota', 'crema'],
        categories: { abrigo: 1, inferior: 1 },
        items: [
          {
            id: 'g-1',
            name: 'Blazer Terracota',
            category: 'abrigo',
            subcategory: 'blazers',
            color: 'terracota',
            colorHex: '#B5593B',
            season: 'otono',
            occasion: 'trabajo',
            wearCount: 3,
          },
          {
            id: 'g-2',
            name: 'Pantalón Crema',
            category: 'inferior',
            subcategory: 'pantalones',
            color: 'crema',
            colorHex: '#F3E3C8',
            season: 'todo_el_ano',
            occasion: 'trabajo',
            wearCount: 5,
          },
        ],
      },
    },
    {
      recommendationType: 'outfit',
      title: 'Conjunto Ejecutivo',
      occasion: 'Reunión formal',
      garmentIds: ['g-1', 'g-2'],
    },
  );

  assert.equal(explanation.basedOnRealData, true);
  assert.match(explanation.reasonSummary, /Otoño Cálido/);
  assert.match(explanation.reasonSummary, /Blazer Terracota/);
  assert.match(explanation.reasonSummary, /Quiet Luxury/);
  assert.ok(
    explanation.consideredFactors.some((f) => f.category === 'colorimetria'),
  );
  assert.ok(
    explanation.consideredFactors.some((f) => f.category === 'armario'),
  );
});
