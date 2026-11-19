import {
  changeReason, closestStyles, combine, contributions, declaredVector, dimensionChanges, inferredVector, learn,
  MIN_WARDROBE_ITEMS, NEUTRAL_DNA, sameVector, styleVector, topDimensions, wardrobeVector,
  collapseHistory, predominantDimensions,
} from './style-dna';
import { garmentDna } from '../outfits/outfit.engine';
import { normalizeOccasion, recommend } from './recommendation.engine';
import { colorToHex, hexDistance, isNeutral, matchesDeclared } from '../../common/color/color.util';

const diagnosis = {
  season: 'Primavera Clara (Light Spring)',
  undertone: 'Calido',
  faceShape: 'Redondo',
  bodyType: 'Reloj de Arena (Hourglass)',
  contrastLevel: 'Medio',
  colorimetry: { explanations: { contrastRule: 'Combina tonos con diferencia moderada.' } },
  recommendations: {
    colors: {
      recommended: [{ hex: '#5B8DB8', name: 'Azul aguamarina', category: 'base' }],
      accents: [{ hex: '#FFB4A2', name: 'Melocotón', category: 'acento' }],
      neutrals: [{ hex: '#E7DCCB', name: 'Crema', category: 'neutro' }],
      avoid: [{ hex: '#000000', name: 'Negro puro', reason: 'Te resta frescura.' }],
    },
    haircuts: ['Bob largo angular'],
    hairShades: ['Rubio miel'],
    glasses: ['Rectangulares'],
    necklines: ['En V'],
    accessories: ['Aretes largos'],
    metals: ['Oro amarillo'],
    lipsticks: ['Coral'],
    garmentCuts: ['Vestidos cruzados (wrap)'],
    lines: ['Líneas curvas'],
    lengths: ['Faldas midi'],
  },
};

describe('Style DNA (HU-007/008/039)', () => {
  it('traduce estilos declarados y se aleja de los que no gustan', () => {
    const v = declaredVector(['Quiet Luxury', 'Minimalista Sofisticado'], ['Y2K Glam'])!;
    expect(v.minimalismo).toBeGreaterThan(70);
    expect(v.experimentalidad).toBeLessThan(20);
    expect(declaredVector([], [])).toBeNull();
    expect(styleVector('desconocido')).toBeNull();
  });

  it('infiere de forma suave desde el diagnóstico', () => {
    const v = inferredVector({ contrastLevel: 'Alto', faceShape: 'Cuadrado', bodyType: 'Rectangular / Atletica', season: 'Invierno Brillante' })!;
    expect(v.dramatismo).toBeGreaterThan(60);
    expect(inferredVector(null)).toBeNull();
  });

  it('lo declarado pesa más que lo inferido', () => {
    const declared = { ...NEUTRAL_DNA, elegancia: 90 };
    const inferred = { ...NEUTRAL_DNA, elegancia: 10 };
    expect(combine({ declared, inferred, learned: null }, 0).elegancia).toBeGreaterThan(65);
    expect(combine({ declared: null, inferred: null, learned: null }, 0)).toEqual(NEUTRAL_DNA);
  });

  it('aprende: me gusta acerca, no me gusta aleja, neutral no cambia', () => {
    const target = { ...NEUTRAL_DNA, romanticismo: 95 };
    expect(learn(NEUTRAL_DNA, target, 'me_gusta', 0).romanticismo).toBeGreaterThan(50);
    expect(learn(NEUTRAL_DNA, target, 'no_me_gusta', 0).romanticismo).toBeLessThan(50);
    expect(learn(NEUTRAL_DNA, target, 'neutral', 0)).toEqual(NEUTRAL_DNA);
  });

  it('resume dimensiones y estilos cercanos', () => {
    const v = declaredVector(['Romántico Clásico'])!;
    expect(topDimensions(v, 1)[0].dimension).toBe('romanticismo');
    expect(closestStyles(v, 2)[0].style.toLowerCase()).toContain('romántico');
  });
});

describe('Motor de recomendaciones (HU-012/013/014/037)', () => {
  const dna = declaredVector(['Clásico'])!;

  it('genera recomendaciones explicadas y con ids estables', () => {
    const items = recommend({ diagnosis, preferences: {}, dna });
    expect(items.length).toBeGreaterThan(10);
    for (const r of items) expect(r.explanation.length).toBeGreaterThan(0);
    const again = recommend({ diagnosis, preferences: {}, dna });
    expect(again.map((r) => r.id)).toEqual(items.map((r) => r.id));
  });

  it('respeta los colores que la usuaria quiere evitar y prioriza los preferidos', () => {
    const items = recommend({ diagnosis, preferences: { avoidedColors: ['crema'], preferredColors: ['azul'] }, dna });
    expect(items.some((r) => r.type === 'color' && r.title === 'Crema')).toBe(false);
    const azul = items.find((r) => r.title === 'Azul aguamarina')!;
    expect(azul.explanation.some((e) => e.factor === 'Tus preferencias')).toBe(true);
  });

  it('oculta lo que no gustó y sube lo que gustó', () => {
    const base = recommend({ diagnosis, preferences: {}, dna });
    const id = base.find((r) => r.type === 'corte_cabello')!.id;
    expect(recommend({ diagnosis, preferences: {}, dna, feedback: { [id]: 'no_me_gusta' } }).some((r) => r.id === id)).toBe(false);
    const liked = recommend({ diagnosis, preferences: {}, dna, feedback: { [id]: 'me_gusta' } }).find((r) => r.id === id)!;
    expect(liked.score).toBeGreaterThan(base.find((r) => r.id === id)!.score);
  });

  it('añade prendas según la ocasión y el presupuesto, también sin diagnóstico', () => {
    const items = recommend({ diagnosis: null, preferences: { budgetPerGarment: 100 }, dna, occasion: 'Entrevista de trabajo' });
    expect(items.some((r) => r.id.endsWith(':trabajo'))).toBe(true);
    expect(items.filter((r) => r.type === 'prenda').every((r) => r.explanation.some((e) => e.factor === 'Presupuesto'))).toBe(true);
    expect(normalizeOccasion('Salida nocturna')).toBe('fiesta');
    expect(normalizeOccasion(undefined)).toBeNull();
  });
});

describe('Utilidades de color', () => {
  it('mide distancias y reconoce neutros y nombres', () => {
    expect(hexDistance('#FFFFFF', '#FFFFFF')).toBeCloseTo(0);
    expect(hexDistance('#000000', '#FFFFFF')).toBeGreaterThan(90);
    expect(isNeutral('#808080')).toBe(true);
    expect(isNeutral('#C62828')).toBe(false);
    expect(colorToHex('rojo vino')).toBe('#C62828');
    expect(colorToHex('#abcdef')).toBe('#ABCDEF');
    expect(colorToHex('xyz')).toBeNull();
    expect(matchesDeclared('Marfil', '#F5EFE0', ['crema'])).toBe('crema');
    expect(matchesDeclared('Azul', '#1E5BB8', ['rosa'])).toBeNull();
  });
});

describe('Perfil de estilo que evoluciona con el uso (HU-13)', () => {
  const declared = declaredVector(['Minimalista'])!;
  const inferred = inferredVector(diagnosis)!;

  it('combina diagnóstico y preferencias, y lo declarado pesa más', () => {
    const c = contributions({ declared, inferred, learned: null }, 0);
    expect(c.map((x) => x.source)).toEqual(['declared', 'inferred']);
    expect(c[0].percent).toBe(75);
    expect(c.reduce((a, x) => a + x.percent, 0)).toBe(100);
  });

  it('el armario cuenta desde 3 prendas y las más usadas pesan más', () => {
    const bohemio = { dna: garmentDna({ subcategory: 'vestidos', styles: ['Bohemio'] } as any), wearCount: 0 };
    const formal = { dna: garmentDna({ subcategory: 'blazers', styles: ['Elegante'] } as any), wearCount: 0 };
    expect(wardrobeVector([bohemio, formal])).toBeNull();
    expect(MIN_WARDROBE_ITEMS).toBe(3);
    const pocoUso = wardrobeVector([bohemio, formal, formal])!;
    const muchoUso = wardrobeVector([{ ...bohemio, wearCount: 9 }, formal, formal])!;
    expect(muchoUso.romanticismo).toBeGreaterThan(pocoUso.romanticismo);
  });

  it('el perfil se mueve hacia el estilo de su armario sin pisar lo declarado', () => {
    const urbano = { dna: garmentDna({ subcategory: 'zapatillas', styles: ['Urbano'] } as any), wearCount: 4 };
    const wardrobe = wardrobeVector([urbano, urbano, urbano, urbano, urbano])!;
    const antes = combine({ declared, inferred, learned: null }, 0);
    const despues = combine({ declared, inferred, learned: null, wardrobe }, 0, 5);
    expect(despues.experimentalidad).toBeGreaterThan(antes.experimentalidad);
    expect(despues.minimalismo).toBeGreaterThan(60); // sigue mandando lo que declaró
    const c = contributions({ declared, inferred, learned: null, wardrobe }, 0, 5);
    expect(c.find((x) => x.source === 'declared')!.percent).toBeGreaterThan(c.find((x) => x.source === 'wardrobe')!.percent);
  });

  it('explica por qué cambió y qué dimensiones se movieron', () => {
    expect(changeReason(null, { declared, inferred: null, learned: null })).toBe('creacion');
    expect(changeReason({ declared: null, inferred: null, learned: null }, { declared, inferred: null, learned: null })).toBe('preferencias');
    expect(changeReason({ declared, inferred: null, learned: null }, { declared, inferred, learned: null })).toBe('diagnostico');
    expect(changeReason({ declared, inferred, learned: null }, { declared, inferred, learned: null, wardrobe: NEUTRAL_DNA })).toBe('armario');
    expect(changeReason({ declared, inferred, learned: null }, { declared, inferred, learned: NEUTRAL_DNA })).toBe('valoraciones');
    expect(changeReason({ declared, inferred, learned: null }, { declared, inferred, learned: null })).toBe('recalculo');
    // El JSONB de PostgreSQL devuelve las claves en otro orden: no es un cambio
    const reordenado = Object.fromEntries(Object.entries(declared).reverse()) as typeof declared;
    expect(JSON.stringify(reordenado)).not.toBe(JSON.stringify(declared));
    expect(sameVector(reordenado, declared)).toBe(true);
    expect(changeReason({ declared: reordenado, inferred, learned: null }, { declared, inferred, learned: null })).toBe('recalculo');
    const moved = dimensionChanges(NEUTRAL_DNA, { ...NEUTRAL_DNA, dramatismo: 70, elegancia: 48 });
    expect(moved).toEqual([{ dimension: 'dramatismo', label: 'Dramatismo', from: 50, to: 70, delta: 20 }]);
  });
});

describe('HU-13: evolución legible del perfil', () => {
  it('un perfil neutro no tiene dimensiones predominantes; uno marcado sí', () => {
    expect(predominantDimensions(NEUTRAL_DNA)).toEqual([]);
    expect(predominantDimensions({ ...NEUTRAL_DNA, elegancia: 54 })).toEqual([]);
    expect(predominantDimensions({ ...NEUTRAL_DNA, elegancia: 72, minimalismo: 61 })).toEqual(['Elegancia', 'Minimalismo']);
  });

  it('los puntos seguidos sin cambios se funden y se conserva cuándo empezó cada estado', () => {
    const marked = { ...NEUTRAL_DNA, dramatismo: 70 };
    // Más reciente primero, como lo devuelve la consulta
    const points = [
      { id: 'd', dimensions: marked },
      { id: 'c', dimensions: { ...marked } },
      { id: 'b', dimensions: NEUTRAL_DNA },
      { id: 'a', dimensions: { ...NEUTRAL_DNA } },
    ];
    expect(collapseHistory(points).map((p) => p.id)).toEqual(['c', 'a']);
    expect(collapseHistory([])).toEqual([]);
  });
});
