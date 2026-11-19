import { OutfitGeneratorService, toEngineGarment } from './outfit-generator.service';
import type { WardrobeItem } from './entities/wardrobe-item.entity';
import { garmentDna } from '../outfits/outfit.engine';
import { declaredVector } from '../style/style-dna';
import { buildFeedbackProfile } from '../outfits/feedback-profile';

let n = 0;
const item = (p: Partial<WardrobeItem>): WardrobeItem =>
  ({
    id: `w${++n}`, name: null, category: 'superior', subcategory: 'blusas', color: null, colorHex: null,
    season: 'todo_el_ano', occasion: null, status: 'confirmed', wearCount: 0, lastWornAt: null,
    aiMetadata: {}, enhancedImageUrl: null, originalImageUrl: null, ...p,
  }) as WardrobeItem;

describe('Combinaciones del armario con el contexto personal (GET /wardrobe/outfits)', () => {
  const gen = new OutfitGeneratorService();
  const closet = [
    item({ name: 'Blusa coral', subcategory: 'blusas', color: 'Coral', colorHex: '#FF7F6B' }),
    item({ name: 'Blusa azul hielo', subcategory: 'blusas', color: 'Azul', colorHex: '#9CC3E6' }),
    item({ name: 'Pantalón gris', category: 'inferior', subcategory: 'pantalones', color: 'Gris', colorHex: '#808080' }),
    item({ name: 'Zapatillas', category: 'calzado', subcategory: 'zapatillas', color: 'Blanco', colorHex: '#F8F8F8' }),
    item({ name: 'Tacones', category: 'calzado', subcategory: 'tacones', color: 'Negro', colorHex: '#111111' }),
  ];

  it('sin contexto mantiene el comportamiento anterior (sin puntuación)', () => {
    const out = gen.generate(closet, {});
    expect(out.outfits.length).toBeGreaterThan(0);
    expect(out.outfits[0].score).toBeUndefined();
  });

  it('con la paleta del diagnóstico prioriza los colores que favorecen y lo explica', () => {
    const ctx = { palette: [{ hex: '#9CC3E6', name: 'Azul hielo' }], avoidColors: [{ hex: '#FF7F6B', name: 'Coral' }] };
    const out = gen.generate(closet, {}, ctx);
    const first = out.outfits[0];
    expect(first.pieces.map((p) => p.item.name)).toContain('Blusa azul hielo');
    expect(first.score).toBeGreaterThan(out.outfits[out.outfits.length - 1].score!);
    expect(first.reason).toMatch(/paleta|neutro/i);
  });

  it('elige el calzado que encaja con el conjunto y la ocasión', () => {
    const out = gen.generate(closet, { occasion: 'trabajo' }, { occasion: 'trabajo' });
    const shoe = out.outfits[0].pieces.find((p) => p.role === 'calzado');
    expect(shoe?.item.name).toBe('Tacones');
  });

  it('una prenda con un color que la usuaria evita queda al final', () => {
    const out = gen.generate(closet, {}, { declaredAvoid: ['coral'] });
    expect(out.outfits[0].pieces.map((p) => p.item.name)).not.toContain('Blusa coral');
  });

  it('usa el estilo y la ocasión que detectó la IA en la foto', () => {
    const blazer = item({ subcategory: 'blazers', category: 'abrigo', aiMetadata: { styles: ['Casual'], suggestedOccasion: 'casual', pattern: 'liso' } });
    const g = toEngineGarment(blazer);
    expect(g.styles).toEqual(['Casual']);
    expect(g.aiOccasion).toBe('casual');
    // Un blazer que la IA ve casual es menos «elegante» que uno sin analizar
    expect(garmentDna(g).elegancia).toBeLessThan(garmentDna({ ...g, styles: [] }).elegancia);
    expect(garmentDna(g).naturalidad).toBeGreaterThan(garmentDna({ ...g, styles: [] }).naturalidad);
    expect(declaredVector(['Casual'])).not.toBeNull();
  });
});

describe('Combinaciones del armario según las valoraciones guardadas (HU-23)', () => {
  const gen = new OutfitGeneratorService();
  const closet = [
    item({ id: 'b1', name: 'Blusa blanca', subcategory: 'blusas', color: 'Blanco', colorHex: '#F8F8F8' }),
    item({ id: 'b2', name: 'Camisa azul', subcategory: 'camisas', color: 'Azul', colorHex: '#3B6EA5' }),
    item({ id: 'p1', name: 'Jeans', category: 'inferior', subcategory: 'jeans', color: 'Azul', colorHex: '#4A6FA5' }),
    item({ id: 'p2', name: 'Falda negra', category: 'inferior', subcategory: 'faldas', color: 'Negro', colorHex: '#111111' }),
  ];
  const engine = closet.map(toEngineGarment);
  const coreOf = (o: { pieces: { role: string; item: { id: string } }[] }) =>
    o.pieces.filter((p) => p.role === 'superior' || p.role === 'inferior').map((p) => p.item.id).sort().join('+');

  it('la combinación que no agradó baja al final y la que agradó sube, con el porqué', () => {
    const base = gen.generate(closet, { limit: 4 }, {});
    const first = coreOf(base.outfits[0]);
    const last = coreOf(base.outfits[base.outfits.length - 1]);
    const feedback = buildFeedbackProfile({
      wardrobe: engine,
      outfits: [{ itemIds: first.split('+'), value: 'no_me_gusta' }, { itemIds: last.split('+'), value: 'me_gusta' }],
      garments: [],
    });
    const out = gen.generate(closet, { limit: 4 }, { feedback });
    expect(coreOf(out.outfits[0])).toBe(last);
    expect(out.outfits[0].isPrioritized).toBe(true);
    expect(out.outfits[0].reason).toMatch(/valoraste como agradable/);
    expect(coreOf(out.outfits[out.outfits.length - 1])).toBe(first);
    expect(out.outfits[out.outfits.length - 1].isPrioritized).toBeFalsy();
  });
});
