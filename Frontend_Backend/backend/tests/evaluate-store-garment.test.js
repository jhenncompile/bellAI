// HU-24: Pruebas del evaluador de compatibilidad de prendas de tienda con perfil y armario.
// Ejecutar con: npm run build && node --test tests/evaluate-store-garment.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  StoreGarmentEvaluatorService,
} = require('../dist/modules/wardrobe/store-garment-evaluator.service');

function createMockRepository(data = []) {
  return {
    findOne: async (query) => {
      if (typeof query?.where === 'object') {
        return (
          data.find((item) =>
            Object.entries(query.where).every(([k, v]) => item[k] === v),
          ) || null
        );
      }
      return data[0] || null;
    },
    find: async (query) => {
      if (typeof query?.where === 'object') {
        return data.filter((item) =>
          Object.entries(query.where).every(([k, v]) => item[k] === v),
        );
      }
      return [...data];
    },
  };
}

test('evalúa con compatibilidad alta una prenda que favorece la estación y combina con el armario', async () => {
  const diagnostic = {
    userId: 'user-1',
    seasonalPalette: 'Otoño Cálido',
    undertone: 'Cálido',
    createdAt: new Date(),
  };

  const wardrobeItems = [
    {
      id: 'item-1',
      userId: 'user-1',
      name: 'Pantalón Negro Recto',
      category: 'inferior',
      subcategory: 'pantalones',
      color: 'Negro',
      status: 'confirmed',
      season: 'todo_el_ano',
      enhancedImageUrl: 'https://cdn.bellia.com/p1.webp',
    },
    {
      id: 'item-2',
      userId: 'user-1',
      name: 'Falda Denim Azul',
      category: 'inferior',
      subcategory: 'faldas',
      color: 'Denim',
      status: 'confirmed',
      season: 'verano',
      enhancedImageUrl: 'https://cdn.bellia.com/p2.webp',
    },
  ];

  const evaluator = new StoreGarmentEvaluatorService(
    createMockRepository(wardrobeItems),
    createMockRepository([diagnostic]),
    createMockRepository([]),
  );

  const result = await evaluator.evaluate('user-1', {
    name: 'Blusa Lino Mostaza',
    category: 'superior',
    subcategory: 'blusas',
    color: 'Mostaza',
    colorHex: '#D9A441',
  });

  assert.equal(result.compatibilityLevel, 'alto');
  assert.ok(result.compatibilityScore >= 75);
  assert.equal(result.colorAnalysis.seasonalHarmony, 'favorable');
  assert.ok(result.matchingWardrobeItems.length >= 2);
  assert.ok(result.verdictTitle.includes('Compatibilidad Alta'));
  assert.ok(result.summary.length > 0);
  assert.ok(!result.summary.includes('delve'));
  assert.ok(!result.summary.includes('testamento'));
  assert.ok(!result.summary.includes('tapiz'));
});

test('evalúa con compatibilidad baja cuando el tono es desfavorable para la estación', async () => {
  const diagnostic = {
    userId: 'user-1',
    seasonalPalette: 'Otoño Cálido',
    undertone: 'Cálido',
    createdAt: new Date(),
  };

  const wardrobeItems = [
    {
      id: 'item-1',
      userId: 'user-1',
      name: 'Pantalón Negro',
      category: 'inferior',
      subcategory: 'pantalones',
      color: 'Negro',
      status: 'confirmed',
    },
  ];

  const evaluator = new StoreGarmentEvaluatorService(
    createMockRepository(wardrobeItems),
    createMockRepository([diagnostic]),
    createMockRepository([]),
  );

  const result = await evaluator.evaluate('user-1', {
    name: 'Top Rosa Fucsia Brillante',
    category: 'superior',
    subcategory: 'tops',
    color: 'Fucsia brillante',
  });

  assert.equal(result.compatibilityLevel, 'bajo');
  assert.equal(result.colorAnalysis.seasonalHarmony, 'desfavorable');
  assert.ok(result.verdictTitle.includes('Compatibilidad Baja'));
  assert.ok(result.recommendationTips.length > 0);
});

test('alerta cuando la prenda no tiene con qué combinar en el armario para evitar compras inútiles', async () => {
  const diagnostic = {
    userId: 'user-1',
    seasonalPalette: 'Invierno',
    undertone: 'Frío',
    createdAt: new Date(),
  };

  // Armario vacío o sin prendas inferiores
  const wardrobeItems = [
    {
      id: 'item-1',
      userId: 'user-1',
      name: 'Camisa Blanca',
      category: 'superior',
      subcategory: 'camisas',
      color: 'Blanco',
      status: 'confirmed',
    },
  ];

  const evaluator = new StoreGarmentEvaluatorService(
    createMockRepository(wardrobeItems),
    createMockRepository([diagnostic]),
    createMockRepository([]),
  );

  // La usuaria evalúa otra prenda superior
  const result = await evaluator.evaluate('user-1', {
    name: 'Blusa Azul Marino',
    category: 'superior',
    subcategory: 'blusas',
    color: 'Azul marino',
  });

  // Sin piezas inferiores, matchCount es 0 -> compatibilidad baja o advertencia de armario
  assert.equal(result.matchingWardrobeItems.length, 0);
  assert.equal(result.compatibilityLevel, 'bajo');
  assert.ok(result.summary.includes('armario') || result.wardrobeAnalysis.description.includes('armario'));
});

test('evalúa versatilidad neutra cuando la usuaria no tiene diagnóstico previo', async () => {
  const wardrobeItems = [
    {
      id: 'item-1',
      userId: 'user-1',
      name: 'Pantalón Beige',
      category: 'inferior',
      subcategory: 'pantalones',
      color: 'Beige',
      status: 'confirmed',
    },
    {
      id: 'item-2',
      userId: 'user-1',
      name: 'Falda Negra',
      category: 'inferior',
      subcategory: 'faldas',
      color: 'Negro',
      status: 'confirmed',
    },
  ];

  const evaluator = new StoreGarmentEvaluatorService(
    createMockRepository(wardrobeItems),
    createMockRepository([]), // sin diagnóstico
    createMockRepository([]),
  );

  const result = await evaluator.evaluate('user-1', {
    name: 'Camisa Blanca',
    category: 'superior',
    subcategory: 'camisas',
    color: 'Blanco',
  });

  assert.equal(result.compatibilityLevel, 'alto');
  assert.ok(result.matchingWardrobeItems.length >= 2);
  assert.ok(result.colorAnalysis.description.includes('análisis'));
});

