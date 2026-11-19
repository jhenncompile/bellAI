// HU-19 / HU-23: pruebas del generador de combinaciones del armario y ajuste por valoraciones.
// Ejecutar con: npm run build && node --test tests/outfits.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  OutfitGeneratorService,
} = require('../dist/modules/wardrobe/outfit-generator.service');

let seq = 1;
function garment(overrides) {
  return {
    id: `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`,
    userId: 'u1',
    name: null,
    category: 'superior',
    subcategory: 'blusas',
    color: null,
    colorHex: null,
    season: null,
    status: 'confirmed',
    originalImageUrl: null,
    enhancedImageUrl: null,
    wearCount: 0,
    lastWornAt: null,
    ...overrides,
  };
}

const generator = new OutfitGeneratorService();

test('informa cuando el armario está vacío', () => {
  const res = generator.generate([]);
  assert.equal(res.isSufficient, false);
  assert.equal(res.outfits.length, 0);
  assert.ok(res.insufficient.missing.length >= 2);
});

test('informa qué falta cuando sólo hay prendas superiores', () => {
  const res = generator.generate([garment({}), garment({ subcategory: 'camisas' })]);
  assert.equal(res.isSufficient, false);
  assert.ok(res.insufficient.missing.some((m) => m.includes('inferior')));
  assert.ok(!res.insufficient.missing.some((m) => m.includes('superior:')));
});

test('los borradores no cuentan como prendas registradas', () => {
  const res = generator.generate([
    garment({}),
    garment({ category: 'inferior', subcategory: 'jeans', status: 'draft' }),
  ]);
  assert.equal(res.isSufficient, false);
});

test('cada combinación tiene superior + inferior, o cuerpo entero', () => {
  const items = [
    garment({ color: 'Blanco', colorHex: '#FFFFFF' }),
    garment({ subcategory: 'camisetas', color: 'Terracota', colorHex: '#A8604B' }),
    garment({ category: 'inferior', subcategory: 'jeans', color: 'Azul', colorHex: '#2B4C7E' }),
    garment({ category: 'inferior', subcategory: 'faldas', color: 'Negro', colorHex: '#111111' }),
    garment({ subcategory: 'vestidos', color: 'Verde', colorHex: '#2D5A3F' }),
    garment({ category: 'calzado', subcategory: 'zapatillas' }),
  ];
  const ids = new Set(items.map((i) => i.id));
  const res = generator.generate(items, { limit: 20 });

  assert.equal(res.isSufficient, true);
  assert.ok(res.outfits.length > 0);
  for (const outfit of res.outfits) {
    const roles = outfit.pieces.map((p) => p.role);
    const twoPiece = roles.includes('superior') && roles.includes('inferior');
    const onePiece = roles.includes('cuerpo_entero');
    assert.ok(twoPiece || onePiece, `combinación incompleta: ${roles.join(',')}`);
    // Sólo prendas del armario
    for (const p of outfit.pieces) assert.ok(ids.has(p.item.id));
  }
  assert.ok(res.outfits.some((o) => o.type === 'cuerpo_entero'));
});

test('un vestido solo ya permite generar combinaciones', () => {
  const res = generator.generate([garment({ subcategory: 'vestidos' })]);
  assert.equal(res.isSufficient, true);
  assert.equal(res.outfits.length, 1);
  assert.equal(res.outfits[0].pieces[0].role, 'cuerpo_entero');
});

test('no combina prendas de temporadas opuestas', () => {
  const res = generator.generate([
    garment({ season: 'verano' }),
    garment({ category: 'inferior', subcategory: 'pantalones', season: 'invierno' }),
  ]);
  assert.equal(res.isSufficient, true);
  assert.equal(res.outfits.length, 0);
  assert.ok(res.noMatches);
});

test('el filtro de temporada respeta las prendas de todo el año', () => {
  const res = generator.generate(
    [
      garment({ season: 'todo_el_ano' }),
      garment({ category: 'inferior', subcategory: 'jeans', season: 'verano' }),
      garment({ category: 'inferior', subcategory: 'pantalones', season: 'invierno' }),
    ],
    { season: 'verano' },
  );
  assert.equal(res.outfits.length, 1);
  assert.equal(res.outfits[0].pieces[1].item.season, 'verano');
});

test('el abrigo sólo se añade en otoño o invierno', () => {
  const items = [
    garment({ season: 'invierno' }),
    garment({ category: 'inferior', subcategory: 'pantalones', season: 'invierno' }),
    garment({ category: 'abrigo', subcategory: 'abrigos', season: 'invierno' }),
  ];
  const winter = generator.generate(items);
  assert.ok(winter.outfits[0].pieces.some((p) => p.role === 'abrigo'));

  const summer = generator.generate([
    garment({ season: 'verano' }),
    garment({ category: 'inferior', subcategory: 'shorts', season: 'verano' }),
    garment({ category: 'abrigo', subcategory: 'abrigos', season: 'todo_el_ano' }),
  ]);
  assert.ok(!summer.outfits[0].pieces.some((p) => p.role === 'abrigo'));
});

test('ninguna prenda principal se repite más de dos veces', () => {
  const items = [
    garment({ color: 'Negro', colorHex: '#000000' }),
    garment({ category: 'inferior', subcategory: 'jeans' }),
    garment({ category: 'inferior', subcategory: 'faldas' }),
    garment({ category: 'inferior', subcategory: 'shorts' }),
    garment({ category: 'inferior', subcategory: 'pantalones' }),
  ];
  const res = generator.generate(items, { limit: 10 });
  const counts = {};
  for (const o of res.outfits) {
    for (const p of o.pieces) counts[p.item.id] = (counts[p.item.id] || 0) + 1;
  }
  assert.ok(Object.values(counts).every((n) => n <= 2));
});

test('prioriza las prendas menos usadas', () => {
  const worn = garment({ wearCount: 30 });
  const fresh = garment({ wearCount: 0 });
  const res = generator.generate([
    worn,
    fresh,
    garment({ category: 'inferior', subcategory: 'jeans' }),
  ]);
  assert.equal(res.outfits[0].pieces[0].item.id, fresh.id);
});

test('HU-23: las prendas valoradas negativamente aparecen con menor frecuencia', () => {
  const topA = garment({ name: 'Blusa Rechazada' });
  const topB = garment({ name: 'Camisa Neutra' });
  const bottom = garment({ category: 'inferior', subcategory: 'pantalones' });

  // Con límite 1, si topA está valorada negativamente, topB debe ser elegida
  const res = generator.generate([topA, topB, bottom], {
    limit: 1,
    dislikedGarmentIds: [topA.id],
  });

  assert.equal(res.outfits.length, 1);
  assert.equal(res.outfits[0].pieces[0].item.id, topB.id);
});

test('HU-23: las características y prendas valoradas positivamente se priorizan en nuevas propuestas', () => {
  const topA = garment({ name: 'Top A', colorHex: '#111111' });
  const topFav = garment({ name: 'Top Favorito', colorHex: '#A8604B' });
  const bottom = garment({ category: 'inferior', subcategory: 'faldas' });

  const res = generator.generate([topA, topFav, bottom], {
    limit: 2,
    likedGarmentIds: [topFav.id],
    likedColors: ['#A8604B'],
  });

  assert.equal(res.outfits[0].pieces[0].item.id, topFav.id);
  assert.equal(res.outfits[0].isPrioritized, true);
  assert.ok(res.outfits[0].reason.includes('priorizada'));
});

test('HU-20: la usuaria puede elegir la ocasión y las propuestas se ajustan (trabajo vs deporte)', () => {
  const blazer = garment({ name: 'Blazer Ejecutivo', category: 'superior', subcategory: 'blazers' });
  const camiseta = garment({ name: 'Camiseta Deportiva', category: 'superior', subcategory: 'camisetas' });
  const pantalon = garment({ name: 'Pantalón de Vestir', category: 'inferior', subcategory: 'pantalones' });
  const shorts = garment({ name: 'Shorts de Correr', category: 'inferior', subcategory: 'shorts' });
  const tacones = garment({ name: 'Tacones Formales', category: 'calzado', subcategory: 'tacones' });
  const zapatillas = garment({ name: 'Zapatillas Running', category: 'calzado', subcategory: 'zapatillas' });

  const items = [blazer, camiseta, pantalon, shorts, tacones, zapatillas];

  // Caso 1: Trabajo
  const resTrabajo = generator.generate(items, { occasion: 'trabajo', limit: 1 });
  assert.equal(resTrabajo.occasion, 'trabajo');
  assert.equal(resTrabajo.occasionLabel, 'Trabajo');
  assert.equal(resTrabajo.outfits[0].pieces[0].item.id, blazer.id);
  assert.equal(resTrabajo.outfits[0].pieces[1].item.id, pantalon.id);
  // Calzado debe preferir tacones sobre zapatillas
  const calzadoTrabajo = resTrabajo.outfits[0].pieces.find((p) => p.role === 'calzado');
  assert.equal(calzadoTrabajo.item.id, tacones.id);

  // Caso 2: Deporte
  const resDeporte = generator.generate(items, { occasion: 'deporte', limit: 1 });
  assert.equal(resDeporte.occasion, 'deporte');
  assert.equal(resDeporte.occasionLabel, 'Deporte');
  assert.equal(resDeporte.outfits[0].pieces[0].item.id, camiseta.id);
  assert.equal(resDeporte.outfits[0].pieces[1].item.id, shorts.id);
  // Calzado debe preferir zapatillas sobre tacones
  const calzadoDeporte = resDeporte.outfits[0].pieces.find((p) => p.role === 'calzado');
  assert.equal(calzadoDeporte.item.id, zapatillas.id);
});

test('HU-20: considera el clima del día (frío vs cálido)', () => {
  const sueter = garment({ name: 'Suéter de Lana', category: 'superior', subcategory: 'sueteres' });
  const top = garment({ name: 'Top Ligero', category: 'superior', subcategory: 'tops' });
  const pantalon = garment({ name: 'Pantalón Grueso', category: 'inferior', subcategory: 'pantalones' });
  const shorts = garment({ name: 'Shorts de Verano', category: 'inferior', subcategory: 'shorts' });
  const abrigo = garment({ name: 'Abrigo Largo', category: 'abrigo', subcategory: 'abrigos' });
  const botas = garment({ name: 'Botas de Cuero', category: 'calzado', subcategory: 'botas' });
  const sandalias = garment({ name: 'Sandalias Abiertas', category: 'calzado', subcategory: 'sandalias' });

  const items = [sueter, top, pantalon, shorts, abrigo, botas, sandalias];

  // Caso 1: Clima Frío (10°C)
  const resFrio = generator.generate(items, {
    weatherCondition: 'frio',
    temperature: 10,
    limit: 1,
  });
  assert.equal(resFrio.weatherCondition, 'frio');
  assert.equal(resFrio.weatherLabel, 'Clima frío');
  assert.equal(resFrio.weatherNotice, null);
  // Debe elegir suéter y pantalón
  assert.equal(resFrio.outfits[0].pieces[0].item.id, sueter.id);
  assert.equal(resFrio.outfits[0].pieces[1].item.id, pantalon.id);
  // Debe incluir calzado botas
  const botaElegida = resFrio.outfits[0].pieces.find((p) => p.role === 'calzado');
  assert.equal(botaElegida.item.id, botas.id);
  // Debe incluir abrigo
  const abrigoElegido = resFrio.outfits[0].pieces.find((p) => p.role === 'abrigo');
  assert.ok(abrigoElegido);
  assert.equal(abrigoElegido.item.id, abrigo.id);

  // Caso 2: Clima Cálido (28°C)
  const resCalido = generator.generate(items, {
    weatherCondition: 'calido',
    temperature: 28,
    limit: 1,
  });
  assert.equal(resCalido.weatherCondition, 'calido');
  assert.equal(resCalido.weatherLabel, 'Clima cálido');
  assert.equal(resCalido.weatherNotice, null);
  // Debe preferir top y shorts
  assert.equal(resCalido.outfits[0].pieces[0].item.id, top.id);
  assert.equal(resCalido.outfits[0].pieces[1].item.id, shorts.id);
  // Debe preferir sandalias sobre botas
  const calzadoCalido = resCalido.outfits[0].pieces.find((p) => p.role === 'calzado');
  assert.equal(calzadoCalido.item.id, sandalias.id);
  // No debe incluir abrigo en clima cálido
  const abrigoCalido = resCalido.outfits[0].pieces.find((p) => p.role === 'abrigo');
  assert.equal(abrigoCalido, undefined);
});

test('HU-20 Criterio 3: si la información climática no está disponible genera combinaciones solo por ocasión y se informa', () => {
  const topTrabajo = garment({ name: 'Blusa Formal', category: 'superior', subcategory: 'blusas' });
  const pantalonTrabajo = garment({ name: 'Pantalón Recto', category: 'inferior', subcategory: 'pantalones' });

  const resSinClima = generator.generate([topTrabajo, pantalonTrabajo], {
    occasion: 'trabajo',
    // weatherCondition omitido / no disponible
  });

  assert.equal(resSinClima.isSufficient, true);
  assert.equal(resSinClima.occasion, 'trabajo');
  assert.equal(resSinClima.weatherCondition, null);
  assert.equal(
    resSinClima.weatherNotice,
    'Información climática no disponible. Se generaron combinaciones solo por la ocasión seleccionada.',
  );
  assert.equal(resSinClima.outfits.length, 1);
  assert.ok(resSinClima.outfits[0].reason.includes('trabajo'));
});
