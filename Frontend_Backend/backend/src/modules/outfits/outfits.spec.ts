import { Garment, generateOutfits, garmentColorScore, isFashionNeutral, outfitSignature, scoreOutfit, summarizeComparison } from './outfit.engine';
import { itemSetKey, OUTFIT_RATINGS, RATING_TO_FEEDBACK } from './outfit-ratings';
import { buildFeedbackProfile, garmentAffinity, outfitAffinity } from './feedback-profile';
import { evaluateCompatibility } from '../compatibility/compatibility.engine';
import { declaredVector } from '../style/style-dna';
import { buildIntegratedDiagnosis, toLegacyFaceContract } from '../diagnosis/diagnosis.builder';
import { ruleBasedReply, systemPrompt } from '../assistant/assistant.prompts';

let n = 0;
const g = (p: Partial<Garment>): Garment => ({
  id: `g${++n}`, name: p.subcategory ?? 'prenda', category: 'superior', subcategory: 'blusas', color: null, colorHex: null,
  season: 'todo_el_ano', occasion: null, wearCount: 0, lastWornAt: null, ...p,
});

const wardrobe: Garment[] = [
  g({ name: 'Blusa azul', category: 'superior', subcategory: 'blusas', color: 'Azul', colorHex: '#5B8DB8', occasion: 'trabajo' }),
  g({ name: 'Top naranja', category: 'superior', subcategory: 'tops', color: 'Naranja', colorHex: '#FF6A00', occasion: 'fiesta', season: 'verano' }),
  g({ name: 'Pantalón camel', category: 'inferior', subcategory: 'pantalones', color: 'Camel', colorHex: '#B08968', occasion: 'trabajo' }),
  g({ name: 'Shorts', category: 'inferior', subcategory: 'shorts', color: 'Blanco', colorHex: '#F8F8F8', occasion: 'playa', season: 'verano' }),
  g({ name: 'Mocasines', category: 'calzado', subcategory: 'tacones', color: 'Negro', colorHex: '#111111', occasion: 'trabajo' }),
  g({ name: 'Sandalias', category: 'calzado', subcategory: 'sandalias', color: 'Beige', colorHex: '#D8C3A5', occasion: 'playa', season: 'verano' }),
  g({ name: 'Abrigo', category: 'abrigo', subcategory: 'abrigos', color: 'Gris', colorHex: '#808080', season: 'invierno' }),
];
const palette = [{ hex: '#5B8DB8', name: 'Azul aguamarina' }, { hex: '#B08968', name: 'Camel claro' }];
const ctx = { palette, dna: declaredVector(['Clásico'])!, declaredAvoid: ['naranja'] };

describe('Generador de outfits (HU-015/016/017/038)', () => {
  it('combina prendas reales según ocasión y clima frío con lluvia', () => {
    const out = generateOutfits(wardrobe, { ...ctx, occasion: 'Trabajo', temperatureC: 10, rainy: true }, 3);
    expect(out.length).toBeGreaterThan(0);
    const best = out[0];
    const names = best.items.map((i) => i.name);
    expect(names).toContain('Blusa azul');
    expect(names).not.toContain('Top naranja'); // color que la usuaria evita
    expect(names).not.toContain('Sandalias');
    expect(best.items.some((i) => i.role === 'abrigo')).toBe(true);
    expect(best.breakdown).toHaveLength(7);
  });

  it('en calor evita el abrigo e indica lo que falta en un armario incompleto', () => {
    const hot = generateOutfits(wardrobe, { ...ctx, occasion: 'Playa', temperatureC: 30 }, 2);
    expect(hot[0].items.some((i) => i.subcategory === 'abrigos')).toBe(false);
    const partial = generateOutfits([wardrobe[0]], { ...ctx, budgetPerGarment: 80 }, 1);
    expect(partial[0].missing.map((m) => m.role)).toEqual(expect.arrayContaining(['inferior', 'calzado']));
    expect(partial[0].missing[0].suggestion).toContain('80');
    expect(generateOutfits([], ctx)).toEqual([]);
  });

  it('no repite combinaciones que no gustaron', () => {
    const first = generateOutfits(wardrobe, { ...ctx, occasion: 'Trabajo' }, 1)[0];
    const again = generateOutfits(wardrobe, { ...ctx, occasion: 'Trabajo', dislikedOutfits: new Set([first.id]) }, 3);
    expect(again.some((o) => o.id === first.id)).toBe(false);
    expect(outfitSignature(['b', 'a'], 'Trabajo')).toBe(outfitSignature(['a', 'b'], 'oficina'));
  });

  it('puntúa color y compara conjuntos', () => {
    expect(garmentColorScore(wardrobe[1], ctx).score).toBe(0);
    expect(garmentColorScore(wardrobe[0], ctx).score).toBeGreaterThan(0.8);
    const a = scoreOutfit([{ ...wardrobe[0], role: 'superior' }, { ...wardrobe[2], role: 'inferior' }], { ...ctx, occasion: 'Trabajo' });
    const b = scoreOutfit([{ ...wardrobe[1], role: 'superior' }, { ...wardrobe[3], role: 'inferior' }], { ...ctx, occasion: 'Trabajo' });
    expect(a.score).toBeGreaterThan(b.score);
  });
});

describe('Semáforo de compatibilidad (HU-024/025)', () => {
  const base = { name: null, season: null, occasion: null, wearCount: 0, lastWornAt: null } as const;
  it('verde para una prenda de su paleta que combina con el armario', () => {
    const r = evaluateCompatibility({ ...base, id: 'c1', category: 'superior', subcategory: 'camisas', color: 'Azul', colorHex: '#6192BC' }, wardrobe, { ...ctx });
    expect(r.light).toBe('verde');
    expect(r.combinations.count).toBeGreaterThan(0);
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it('rojo si es un color que evita y advierte presupuesto y duplicados', () => {
    const r = evaluateCompatibility({ ...base, id: 'c2', category: 'superior', subcategory: 'tops', color: 'Naranja', colorHex: '#FF6A00' }, wardrobe, { ...ctx, budgetPerGarment: 50 }, 90);
    expect(r.light).toBe('rojo');
    expect(r.budget.withinBudget).toBe(false);
    expect(r.similarItems.map((s) => s.name)).toContain('Top naranja');
  });
});

describe('Diagnóstico integral y asistente (HU-005/036, HU-026)', () => {
  const face = {
    face: { faceShape: 'Corazon', confidence: 0.8, modelVersion: 'f1', metrics: { symmetry: 0.9 }, recommendations: { cortes: ['Bob'], gafas: ['Ovaladas'], escotes: ['En V'], accesorios: [] }, landmarks: [] },
    colorimetry: {
      season: 'Otono Calido (True Autumn)', skinTone: 'Media', undertone: 'Calido', contrastLevel: 'Medio', confidence: 0.7, modelVersion: 'c1',
      hair: { detected: true, length: 'Largo', baseColor: { name: 'Castaño cálido' } }, metrics: {}, explanations: {},
      colors: { palette: [{ hex: '#78350F', name: 'Terracota', category: 'base' }], recommended: [], neutrals: [], accents: [], toxicColors: [], recommendedMetals: ['Oro amarillo'], glassesFrames: ['Carey'] },
    },
  };
  it('integra rostro, color y cuerpo con resumen y versiones', () => {
    const d = buildIntegratedDiagnosis(face, { body: { bodyType: 'Triangulo / Pera', verticality: 'Torso y piernas equilibrados', confidence: 0.6, modelVersion: 'b1', recommendations: { cuts: ['Falda en A'] } } });
    expect(d.summary).toContain('en forma de corazón');
    expect(d.summary).toContain('Otono Calido');
    expect(d.modelVersions).toEqual({ face: 'f1', colorimetry: 'c1', body: 'b1' });
    expect(d.confidence.overall).toBeCloseTo(0.7, 2);
    expect(d.recommendations.glasses).toEqual(expect.arrayContaining(['Ovaladas', 'Color de montura: Carey']));
    expect(buildIntegratedDiagnosis(null, null).summary).toContain('Aún no hay');
    expect(toLegacyFaceContract(face).facialSymmetry).toBe(90);
  });
  it('el asistente usa los datos reales y respeta lo que la usuaria evita', () => {
    const c = { season: 'Otono Calido', paletteNames: ['Terracota', 'Crema'], declaredAvoid: ['crema'], faceShape: 'Corazon', haircuts: ['Bob'], wardrobe: { total: 3, byCategory: { superior: 3 }, sample: [] } };
    expect(ruleBasedReply('¿qué colores me quedan?', c)).toContain('Terracota');
    expect(ruleBasedReply('¿qué colores me quedan?', c)).not.toContain('Crema');
    expect(ruleBasedReply('qué corte de pelo', c)).toContain('Bob');
    expect(ruleBasedReply('qué me pongo para un evento', c)).toContain('3 prendas');
    expect(ruleBasedReply('hola', {})).toBeTruthy();
    expect(systemPrompt(c)).toContain('NO quiere usar');
  });
});

describe('Reglas de estilo del generador (outfits-1.1.0)', () => {
  const role = (x: Garment, r: string) => ({ ...x, role: r });
  const factor = (o: ReturnType<typeof scoreOutfit>, name: string) => o.breakdown.find((b) => b.factor === name)!.score;

  it('trata el denim y los tierra suaves como neutros, no como colores que compiten', () => {
    expect(isFashionNeutral({ subcategory: 'jeans', colorHex: '#3B5A80' })).toBe(true);
    expect(isFashionNeutral({ subcategory: 'pantalones', colorHex: '#B08968' })).toBe(true); // camel
    expect(isFashionNeutral({ subcategory: 'blusas', colorHex: '#C62828' })).toBe(false);   // rojo
    const red = g({ subcategory: 'blusas', colorHex: '#C62828' });
    const jeans = g({ category: 'inferior', subcategory: 'jeans', colorHex: '#3B5A80' });
    const out = scoreOutfit([role(red, 'superior'), role(jeans, 'inferior')], {});
    expect(factor(out, 'Armonía de colores')).toBeGreaterThanOrEqual(0.85);
  });

  it('penaliza mezclar piezas muy formales con deportivas y dos estampados a la vez', () => {
    const blazer = g({ subcategory: 'blazers', category: 'abrigo' });
    const shorts = g({ subcategory: 'shorts', category: 'inferior' });
    const shoes = g({ subcategory: 'zapatillas', category: 'calzado' });
    const mixed = scoreOutfit([role(blazer, 'abrigo'), role(shorts, 'inferior'), role(shoes, 'calzado')], {});
    expect(factor(mixed, 'Coherencia de estilo')).toBeLessThan(0.5);
    const camisa = g({ subcategory: 'camisas' });
    const pants = g({ subcategory: 'pantalones', category: 'inferior' });
    expect(factor(scoreOutfit([role(camisa, 'superior'), role(pants, 'inferior')], {}), 'Coherencia de estilo')).toBe(1);
    const stripes = g({ subcategory: 'blusas', pattern: 'rayas' });
    const floral = g({ subcategory: 'faldas', category: 'inferior', pattern: 'floral' });
    const clash = scoreOutfit([role(stripes, 'superior'), role(floral, 'inferior')], {});
    expect(factor(clash, 'Coherencia de estilo')).toBeLessThanOrEqual(0.4);
    expect(clash.breakdown.find((b) => b.factor === 'Coherencia de estilo')!.detail).toContain('estampadas');
  });

  it('prefiere el conjunto coherente cuando hay alternativa', () => {
    const closet = [
      g({ name: 'Camisa', subcategory: 'camisas', colorHex: '#F8F8F8' }),
      g({ name: 'Shorts', category: 'inferior', subcategory: 'shorts', colorHex: '#111111' }),
      g({ name: 'Pantalón', category: 'inferior', subcategory: 'pantalones', colorHex: '#111111' }),
      g({ name: 'Tacones', category: 'calzado', subcategory: 'tacones', colorHex: '#111111' }),
    ];
    const best = generateOutfits(closet, { occasion: 'Trabajo' }, 1)[0];
    expect(best.items.map((i) => i.name)).toEqual(expect.arrayContaining(['Camisa', 'Pantalón', 'Tacones']));
  });
});

describe('Paleta personal (regresión)', () => {
  it('una prenda lejos de la paleta baja de puntuación pero sigue pudiendo proponerse', () => {
    const dress = g({ name: 'Vestido rojo', subcategory: 'vestidos', color: 'Rojo', colorHex: '#C62828' });
    const pal = { palette: [{ hex: '#9CC3E6', name: 'Azul hielo' }] };
    const s = garmentColorScore(dress, pal).score;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.5);
    expect(generateOutfits([dress], pal, 1)[0].items.map((i) => i.name)).toContain('Vestido rojo');
    // Declarado a evitar: sí se excluye
    expect(garmentColorScore(dress, { ...pal, declaredAvoid: ['rojo'] }).score).toBe(0);
  });
});

describe('Comparar varias combinaciones a la vez (HU-21)', () => {
  const f = (factor: string, score: number) => ({ factor, score, detail: `detalle de ${factor.toLowerCase()}` });
  const a = { index: 0, title: 'Opción 1', score: 0.82, breakdown: [f('Colorimetría', 0.9), f('Ocasión', 0.85), f('Clima', 0.6)] };
  const b = { index: 1, title: 'Opción 2', score: 0.64, breakdown: [f('Colorimetría', 0.55), f('Ocasión', 0.6), f('Clima', 0.62)] };
  const c = { index: 2, title: 'Opción 3', score: 0.4, breakdown: [f('Colorimetría', 0.3), f('Ocasión', 0.45), f('Clima', 0.9)] };

  it('elige la más conveniente y explica en qué gana', () => {
    const r = summarizeComparison([a, b, c]);
    expect(r.winner).toMatchObject({ index: 0, tie: false, winsIn: ['Colorimetría', 'Ocasión'] });
    expect(r.winner!.summary).toBe('Opción 1 es la más conveniente: gana en colorimetría y ocasión.');
    // Clima lo gana la opción 3 aunque pierda en total
    expect(r.rows.find((x) => x.factor === 'Clima')).toMatchObject({ decisive: true, leader: 2 });
    expect(r.perOption[2].winsIn).toEqual(['Clima']);
  });

  it('cada opción trae su motivo, también la que no destaca en nada', () => {
    const r = summarizeComparison([a, b]);
    expect(r.perOption[0].strengths).toEqual(['Colorimetría: detalle de colorimetría', 'Ocasión: detalle de ocasión']);
    expect(r.perOption[1].strengths).toEqual([]);
    expect(r.perOption[1].weaknesses).toEqual([]); // ninguna por debajo de 0,5: es aceptable
    const weak = summarizeComparison([a, c]).perOption[1];
    expect(weak.weaknesses).toEqual(['Colorimetría: detalle de colorimetría', 'Ocasión: detalle de ocasión']);
  });

  it('si están muy parejas lo dice en lugar de forzar una ganadora; diferencias pequeñas no deciden', () => {
    const r = summarizeComparison([a, { ...b, score: 0.815 }]);
    expect(r.winner!.tie).toBe(true);
    expect(r.winner!.summary).toMatch(/muy parejas/);
    expect(r.rows.find((x) => x.factor === 'Clima')).toMatchObject({ decisive: false, leader: null });
  });
});

describe('Guardar y valorar combinaciones (HU-22)', () => {
  it('la misma combinación da la misma clave sin importar el orden, mayúsculas ni repetidas', () => {
    const a = 'B1E2C3D4-0000-4000-8000-000000000002';
    const b = '0a1b2c3d-0000-4000-8000-000000000001';
    expect(itemSetKey([a, b, a])).toBe(itemSetKey([b.toUpperCase(), a.toLowerCase()]));
    expect(itemSetKey([a, b])).toBe(`${b},${a.toLowerCase()}`);
    expect(itemSetKey([a])).not.toBe(itemSetKey([a, b]));
  });

  it('las tres valoraciones equivalen a las del Style DNA', () => {
    expect(OUTFIT_RATINGS).toEqual(['agradable', 'neutral', 'no_agradable']);
    expect(OUTFIT_RATINGS.map((r) => RATING_TO_FEEDBACK[r])).toEqual(['me_gusta', 'neutral', 'no_me_gusta']);
  });
});

describe('Ajustar las recomendaciones según mis valoraciones (HU-23)', () => {
  const blusa = g({ id: 'top-blanca', name: 'Blusa blanca', category: 'superior', subcategory: 'blusas', color: 'Blanco', colorHex: '#F8F8F8' });
  const camisa = g({ id: 'top-azul', name: 'Camisa azul', category: 'superior', subcategory: 'camisas', color: 'Azul', colorHex: '#3B6EA5' });
  const jeans = g({ id: 'bot-jeans', name: 'Jeans', category: 'inferior', subcategory: 'jeans', color: 'Azul', colorHex: '#4A6FA5' });
  const falda = g({ id: 'bot-falda', name: 'Falda negra', category: 'inferior', subcategory: 'faldas', color: 'Negro', colorHex: '#111111' });
  const closet = [blusa, camisa, jeans, falda];
  const core = (o: { items: { id: string; role: string }[] }) => o.items.filter((i) => i.role === 'superior' || i.role === 'inferior').map((i) => i.id).sort().join('+');

  it('aprende de prendas y combinaciones: lo valorado directamente pesa más', () => {
    const p = buildFeedbackProfile({
      wardrobe: closet,
      outfits: [{ itemIds: ['top-blanca', 'bot-falda'], value: 'no_me_gusta' }],
      garments: [{ id: 'top-azul', value: 'me_gusta' }],
    });
    expect(p.size).toBe(2);
    expect(p.garments.get('top-blanca')).toBe(-0.5); // por estar en una combinación que no agradó
    expect(p.garments.get('top-azul')).toBe(1); // valorada sola
    expect(p.dislikedSets).toEqual([['top-blanca', 'bot-falda']]);
  });

  it('la misma combinación valorada dos veces cuenta una vez, con la última valoración', () => {
    const p = buildFeedbackProfile({
      wardrobe: closet,
      outfits: [{ itemIds: ['bot-falda', 'top-blanca'], value: 'no_me_gusta' }, { itemIds: ['TOP-BLANCA', 'bot-falda'], value: 'me_gusta' }],
      garments: [],
    });
    expect(p.size).toBe(1);
    expect(p.dislikedSets).toEqual([]);
    expect(p.garments.get('top-blanca')).toBe(0.5);
  });

  it('las características que agradan (color, tipo) suben también en prendas aún sin valorar', () => {
    const p = buildFeedbackProfile({
      wardrobe: closet,
      outfits: [{ itemIds: ['top-azul', 'bot-jeans'], value: 'me_gusta' }],
      garments: [],
    });
    const nueva = g({ id: 'nueva', name: 'Blusa azul nueva', subcategory: 'blusas', color: 'Azul' });
    expect(p.colors.get('azul')).toBeCloseTo(1 / 3, 2); // dos evidencias de +0,5 → 1/(2+1)
    expect(garmentAffinity(p, nueva)).toBeGreaterThan(0);
    expect(garmentAffinity(p, falda)).toBe(0);
  });

  it('una combinación que no agradó no se vuelve a proponer y sus prendas salen con menor frecuencia', () => {
    const before = generateOutfits(closet, {}, 4);
    const disliked = before[0];
    const ids = disliked.items.filter((i) => i.role === 'superior' || i.role === 'inferior').map((i) => i.id);
    const feedback = buildFeedbackProfile({ wardrobe: closet, outfits: [{ itemIds: ids, value: 'no_me_gusta' }], garments: [] });
    const after = generateOutfits(closet, { feedback }, 4);
    expect(after.map(core)).not.toContain(core(disliked));
    const uses = (list: typeof after) => list.flatMap((o) => o.items.map((i) => i.id)).filter((id) => ids.includes(id)).length;
    expect(uses(after)).toBeLessThan(uses(before));
  });

  it('lo que agradó se prioriza y se explica en «Tus valoraciones»', () => {
    const feedback = buildFeedbackProfile({ wardrobe: closet, outfits: [], garments: [{ id: 'bot-falda', value: 'me_gusta' }] });
    const out = generateOutfits(closet, { feedback }, 3);
    expect(out[0].items.map((i) => i.id)).toContain('bot-falda');
    const factor = out[0].breakdown.find((b) => b.factor === 'Tus valoraciones');
    expect(factor?.detail).toMatch(/te agradaron: Falda negra/);
    expect(factor!.score).toBeGreaterThan(0.5);
    // Sin valoraciones no aparece ese criterio
    expect(generateOutfits(closet, {}, 1)[0].breakdown.some((b) => b.factor === 'Tus valoraciones')).toBe(false);
  });

  it('reconoce la misma combinación aunque la guardada tenga además calzado', () => {
    const p = buildFeedbackProfile({ wardrobe: closet, outfits: [{ itemIds: ['top-azul', 'bot-jeans', 'zapatos'], value: 'me_gusta' }], garments: [] });
    expect(outfitAffinity(p, [camisa, jeans]).likedMatch).toBe(true);
    expect(outfitAffinity(p, [camisa, falda]).likedMatch).toBe(false);
  });
});
