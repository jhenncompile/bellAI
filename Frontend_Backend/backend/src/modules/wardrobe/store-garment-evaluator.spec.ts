import { StoreGarmentEvaluatorService } from './store-garment-evaluator.service';
import type { WardrobeItem } from './entities/wardrobe-item.entity';
import { ciede2000, hexDistance2000 } from '../../common/color/color.util';

let n = 0;
const item = (p: Partial<WardrobeItem>): WardrobeItem =>
  ({
    id: `w${++n}`, name: null, category: 'inferior', subcategory: 'jeans', color: null, colorHex: null,
    season: 'todo_el_ano', occasion: null, status: 'confirmed', wearCount: 0, lastWornAt: null,
    aiMetadata: {}, enhancedImageUrl: null, originalImageUrl: null, ...p,
  }) as WardrobeItem;

const repo = (rows: any) => ({ find: async () => rows, findOne: async () => null });

function service(wardrobe: WardrobeItem[], ai: any = null) {
  return new StoreGarmentEvaluatorService(
    repo(wardrobe) as any, repo(null) as any, repo(null) as any,
    { analyzePhoto: async () => ai } as any,
  );
}

const photo = { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'p.jpg' } as Express.Multer.File;

describe('Evaluar compra en tienda con la foto (HU-24)', () => {
  it('CIEDE2000 coincide con los pares de referencia de Sharma (2005)', () => {
    expect(ciede2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
    expect(ciede2000([22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619])).toBeCloseTo(2.0373, 4);
  });

  it('usa lo que la IA detecta en la foto y avisa si ya tiene una prenda casi igual', async () => {
    const closet = [
      item({ name: 'Jeans azul medio', colorHex: '#3E5F8A', color: 'Denim' }),
      item({ name: 'Jeans negros', colorHex: '#1A1A1A', color: 'Negro' }),
      item({ name: 'Camisa blanca', category: 'superior', subcategory: 'camisas', colorHex: '#F5F5F5', color: 'Blanco' }),
    ];
    const ai = { subcategory: 'jeans', color: 'Denim', color_hex: '#3B5C88', pattern: 'liso', confidence: 0.98 };
    expect(hexDistance2000('#3B5C88', '#3E5F8A')).toBeLessThan(10);
    const r = await service(closet, ai).evaluate('u', { category: 'inferior' } as any, photo);
    expect(r.detectedFromPhoto?.subcategory).toBe('jeans');
    expect(r.similarWardrobeItems.map((s) => s.name)).toEqual(['Jeans azul medio']);
    expect(r.recommendationTips[0]).toContain('muy parecido');
  });

  it('detecta la misma prenda registrada con el vector visual', async () => {
    const v = Array.from({ length: 512 }, (_, i) => Math.sin(i));
    const closet = [item({ name: 'Mis jeans', colorHex: '#3E5F8A', aiMetadata: { embedding: v, pattern: 'liso' } })];
    const ai = { subcategory: 'jeans', color: 'Denim', color_hex: '#3B5C88', pattern: 'liso', feature_vector: v.map((x) => x * 1.01) };
    const withDup = await service(closet, ai).evaluate('u', { category: 'inferior' } as any, photo);
    expect(withDup.similarWardrobeItems[0].likelyDuplicate).toBe(true);
    expect(withDup.recommendationTips[0]).toContain('misma prenda');
    const without = await service([], ai).evaluate('u', { category: 'inferior' } as any, photo);
    expect(withDup.compatibilityScore).toBeLessThan(without.compatibilityScore + 1);
  });

  it('el color que escribe la usuaria manda sobre el detectado, y sin foto funciona como antes', async () => {
    const closet = [item({ name: 'Jeans azul medio', colorHex: '#3E5F8A', color: 'Denim' })];
    const ai = { subcategory: 'jeans', color: 'Denim', color_hex: '#3B5C88', pattern: 'liso' };
    const r = await service(closet, ai).evaluate('u', { category: 'inferior', color: 'Rojo', colorHex: '#C62828' } as any, photo);
    expect(r.similarWardrobeItems).toEqual([]);
    const noPhoto = await service(closet).evaluate('u', { category: 'inferior', subcategory: 'jeans', color: 'Denim' } as any);
    expect(noPhoto.detectedFromPhoto).toBeNull();
    expect(noPhoto.similarWardrobeItems.map((s) => s.name)).toEqual(['Jeans azul medio']);
  });
});
