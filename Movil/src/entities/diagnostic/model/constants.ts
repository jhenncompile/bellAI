import {
  ColorSeason,
  ColorSwatch,
  ToxicColor,
  ActionPalettes,
  MunsellCoordinates,
  ContrastMetric,
} from './types';

export const SEASON_PALETTES: Record<string, ColorSwatch[]> = {
  // --- Las 12 Estaciones Completas de la Colorimetría Personal ---
  'Primavera Brillante (Clear Spring)': [
    { hex: '#FB7185', name: 'Coral Radiante', category: 'acento' },
    { hex: '#38BDF8', name: 'Turquesa Luminoso', category: 'acento' },
    { hex: '#FBBF24', name: 'Amarillo Sol', category: 'acento' },
    { hex: '#4ADE80', name: 'Verde Lima', category: 'base' },
    { hex: '#F43F5E', name: 'Rojo Sandía', category: 'acento' },
    { hex: '#F8FAFC', name: 'Blanco Puro', category: 'neutro' },
    { hex: '#0284C7', name: 'Azul Cobalto Cálido', category: 'base' },
    { hex: '#78350F', name: 'Café Dorado', category: 'base' },
  ],
  'Primavera Calida (True Spring)': [
    { hex: '#EA580C', name: 'Naranja Albaricoque', category: 'acento' },
    { hex: '#CA8A04', name: 'Dorado Mostaza', category: 'acento' },
    { hex: '#16A34A', name: 'Verde Manzana', category: 'base' },
    { hex: '#0284C7', name: 'Azul Caribe', category: 'base' },
    { hex: '#F97316', name: 'Coral Intenso', category: 'acento' },
    { hex: '#FEF3C7', name: 'Crema Suave', category: 'neutro' },
    { hex: '#B45309', name: 'Caramelo Tostado', category: 'base' },
    { hex: '#9A3412', name: 'Terracota Vivo', category: 'acento' },
  ],
  'Primavera Clara (Light Spring)': [
    { hex: '#FDA4AF', name: 'Melocotón Claro', category: 'acento' },
    { hex: '#FEF08A', name: 'Vainilla Solar', category: 'neutro' },
    { hex: '#7DD3FC', name: 'Cielo Aguamarina', category: 'acento' },
    { hex: '#86EFAC', name: 'Menta Suave', category: 'base' },
    { hex: '#FED7AA', name: 'Beige Albaricoque', category: 'neutro' },
    { hex: '#FB923C', name: 'Coral Pastel', category: 'acento' },
    { hex: '#F8FAFC', name: 'Blanco Marfil', category: 'neutro' },
    { hex: '#A16207', name: 'Camel Claro', category: 'base' },
  ],
  'Verano Claro (Light Summer)': [
    { hex: '#F472B6', name: 'Rosa Pastel', category: 'acento' },
    { hex: '#60A5FA', name: 'Azul Cielo', category: 'base' },
    { hex: '#C084FC', name: 'Lavanda Suave', category: 'acento' },
    { hex: '#34D399', name: 'Menta Frío', category: 'acento' },
    { hex: '#94A3B8', name: 'Gris Perla', category: 'neutro' },
    { hex: '#F1F5F9', name: 'Blanco Glaciar Roto', category: 'neutro' },
    { hex: '#FB7185', name: 'Frambuesa Claro', category: 'acento' },
    { hex: '#93C5FD', name: 'Azul Polvo', category: 'base' },
  ],
  'Verano Suave (Soft Summer)': [
    { hex: '#FB7185', name: 'Rosa Empolvado', category: 'acento' },
    { hex: '#3B82F6', name: 'Azul Lavanda', category: 'base' },
    { hex: '#64748B', name: 'Gris Pizarra Claro', category: 'neutro' },
    { hex: '#10B981', name: 'Verde Salvia Frío', category: 'base' },
    { hex: '#A855F7', name: 'Ciruela Suave', category: 'acento' },
    { hex: '#94A3B8', name: 'Gris Humo', category: 'neutro' },
    { hex: '#F1F5F9', name: 'Blanco Roto', category: 'neutro' },
    { hex: '#475569', name: 'Gris Carbón Suave', category: 'neutro' },
  ],
  'Verano Frio (True Summer)': [
    { hex: '#1D4ED8', name: 'Azul Real Frío', category: 'base' },
    { hex: '#E11D48', name: 'Frambuesa', category: 'acento' },
    { hex: '#EC4899', name: 'Rosa Fucsia Suave', category: 'acento' },
    { hex: '#059669', name: 'Verde Glaciar', category: 'acento' },
    { hex: '#475569', name: 'Gris Grafito', category: 'neutro' },
    { hex: '#1E3A8A', name: 'Azul Marino Frío', category: 'base' },
    { hex: '#7C3AED', name: 'Púrpura Orquídea', category: 'acento' },
    { hex: '#F8FAFC', name: 'Blanco Frío', category: 'neutro' },
  ],
  'Otono Suave (Soft Autumn)': [
    { hex: '#9A3412', name: 'Terracota Suave', category: 'acento' },
    { hex: '#4D7C0F', name: 'Verde Oliva Suave', category: 'base' },
    { hex: '#B45309', name: 'Ámbar Miel', category: 'acento' },
    { hex: '#D97706', name: 'Melocotón Tostado', category: 'acento' },
    { hex: '#D6C7B2', name: 'Beige Arena', category: 'neutro' },
    { hex: '#78350F', name: 'Caoba Claro', category: 'base' },
    { hex: '#FEF3C7', name: 'Blanco Cálido', category: 'neutro' },
    { hex: '#57534E', name: 'Gris Cálido', category: 'neutro' },
  ],
  'Otono Calido (True Autumn)': [
    { hex: '#78350F', name: 'Café Camel', category: 'base' },
    { hex: '#C2410C', name: 'Terracota Cálido', category: 'acento' },
    { hex: '#CA8A04', name: 'Mostaza Dorado', category: 'acento' },
    { hex: '#D6C7B2', name: 'Beige Arena', category: 'neutro' },
    { hex: '#4D7C0F', name: 'Verde Oliva', category: 'acento' },
    { hex: '#991B1B', name: 'Rojo Teja', category: 'acento' },
    { hex: '#F8FAFC', name: 'Blanco Cálido', category: 'neutro' },
    { hex: '#18181B', name: 'Marrón Chocolate', category: 'base' },
  ],
  'Otono Fuerte (Deep Autumn)': [
    { hex: '#78350F', name: 'Café Chocolate', category: 'base' },
    { hex: '#991B1B', name: 'Rojo Teja Profundo', category: 'acento' },
    { hex: '#14532D', name: 'Verde Bosque', category: 'base' },
    { hex: '#C2410C', name: 'Naranja Quemado', category: 'acento' },
    { hex: '#CA8A04', name: 'Ocre Dorado', category: 'acento' },
    { hex: '#581C87', name: 'Berenjena Cálido', category: 'acento' },
    { hex: '#D6C7B2', name: 'Beige Arena', category: 'neutro' },
    { hex: '#292524', name: 'Negro Cálido', category: 'base' },
  ],
  'Invierno Brillante (Clear Winter)': [
    { hex: '#E11D48', name: 'Rojo Carmesí Vibrante', category: 'acento' },
    { hex: '#1E3A8A', name: 'Azul Real Cobalto', category: 'base' },
    { hex: '#701A75', name: 'Fucsia Intenso', category: 'acento' },
    { hex: '#059669', name: 'Esmeralda Puro', category: 'acento' },
    { hex: '#F8FAFC', name: 'Blanco Nieve', category: 'neutro' },
    { hex: '#18181B', name: 'Negro Azabache', category: 'base' },
    { hex: '#9333EA', name: 'Púrpura Imperial', category: 'acento' },
    { hex: '#38BDF8', name: 'Azul Hielo', category: 'neutro' },
  ],
  'Invierno Frio (True Winter)': [
    { hex: '#1D4ED8', name: 'Azul Zafiro', category: 'base' },
    { hex: '#C026D3', name: 'Magenta Puro', category: 'acento' },
    { hex: '#DC2626', name: 'Rojo Rubí', category: 'acento' },
    { hex: '#047857', name: 'Verde Esmeralda Frío', category: 'acento' },
    { hex: '#F8FAFC', name: 'Blanco Nieve', category: 'neutro' },
    { hex: '#18181B', name: 'Negro Puro', category: 'base' },
    { hex: '#475569', name: 'Gris Plomo', category: 'neutro' },
    { hex: '#67E8F9', name: 'Cian Glaciar', category: 'acento' },
  ],
  'Invierno Fuerte (Deep Winter)': [
    { hex: '#18181B', name: 'Negro Azabache', category: 'base' },
    { hex: '#881337', name: 'Borgoña Oscuro', category: 'acento' },
    { hex: '#0F172A', name: 'Azul Noche Profundo', category: 'base' },
    { hex: '#064E3B', name: 'Verde Pino Oscuro', category: 'base' },
    { hex: '#581C87', name: 'Púrpura Berenjena', category: 'acento' },
    { hex: '#F8FAFC', name: 'Blanco Puro', category: 'neutro' },
    { hex: '#475569', name: 'Gris Carbón', category: 'neutro' },
    { hex: '#BE123C', name: 'Frambuesa Intenso', category: 'acento' },
  ],

  // Fallbacks generales
  Invierno: [
    { hex: '#000000', name: 'Negro Azabache', category: 'base' },
    { hex: '#FFFFFF', name: 'Blanco Puro', category: 'base' },
    { hex: '#1E3A8A', name: 'Azul Real', category: 'base' },
    { hex: '#BE123C', name: 'Rojo Carmesí', category: 'acento' },
    { hex: '#701A75', name: 'Magenta Intenso', category: 'acento' },
    { hex: '#047857', name: 'Esmeralda Fría', category: 'acento' },
    { hex: '#475569', name: 'Gris Plomo', category: 'neutro' },
    { hex: '#E2E8F0', name: 'Plata Glaciar', category: 'neutro' },
  ],
  Verano: [
    { hex: '#3B82F6', name: 'Azul Lavanda', category: 'base' },
    { hex: '#94A3B8', name: 'Gris Perla', category: 'neutro' },
    { hex: '#F472B6', name: 'Rosa Empolvado', category: 'acento' },
    { hex: '#C084FC', name: 'Lila Suave', category: 'acento' },
    { hex: '#38BDF8', name: 'Cielo Pastel', category: 'base' },
    { hex: '#6EE7B7', name: 'Menta Frío', category: 'acento' },
    { hex: '#F1F5F9', name: 'Blanco Roto', category: 'neutro' },
  ],
  Otono: [
    { hex: '#78350F', name: 'Terracota Cálido', category: 'base' },
    { hex: '#B45309', name: 'Mostaza Dorado', category: 'acento' },
    { hex: '#365314', name: 'Verde Oliva', category: 'base' },
    { hex: '#9A3412', name: 'Óxido / Rust', category: 'acento' },
    { hex: '#D97706', name: 'Ámbar Profundo', category: 'acento' },
    { hex: '#451A03', name: 'Chocolate Cálido', category: 'neutro' },
    { hex: '#FEF3C7', name: 'Beige Crema', category: 'neutro' },
  ],
  Primavera: [
    { hex: '#FB7185', name: 'Coral Radiante', category: 'acento' },
    { hex: '#38BDF8', name: 'Turquesa Luminoso', category: 'acento' },
    { hex: '#FBBF24', name: 'Dorado Brillante', category: 'acento' },
    { hex: '#4ADE80', name: 'Verde Manzana', category: 'base' },
    { hex: '#F43F5E', name: 'Melocotón Vivo', category: 'base' },
    { hex: '#FDE68A', name: 'Vainilla Solar', category: 'neutro' },
    { hex: '#0284C7', name: 'Azul Caribe', category: 'base' },
  ],
};

export const TOXIC_COLORS_BY_SEASON: Record<string, ToxicColor[]> = {
  // --- Colores Desfavorables para las 12 Estaciones ---
  'Primavera Brillante (Clear Spring)': [
    { hex: '#64748B', name: 'Gris Ratón Apagado', negativeEffect: 'Resta vitalidad luminosa al rostro.' },
    { hex: '#334155', name: 'Gris Pizarra Oscuro', negativeEffect: 'Endurece los rasgos cálidos y apaga el iris.' },
  ],
  'Primavera Calida (True Spring)': [
    { hex: '#1E3A8A', name: 'Azul Marino Frío', negativeEffect: 'Apaga la vibración dorada de la piel.' },
    { hex: '#701A75', name: 'Magenta Frío', negativeEffect: 'Genera un contraste discordante y cetrino.' },
  ],
  'Primavera Clara (Light Spring)': [
    { hex: '#18181B', name: 'Negro Azabache', negativeEffect: 'Genera líneas de corte demasiado severas.' },
    { hex: '#881337', name: 'Vino Tinto Frío', negativeEffect: 'Apaga la luminosidad dorada natural.' },
  ],
  'Verano Claro (Light Summer)': [
    { hex: '#EA580C', name: 'Naranja Neón', negativeEffect: 'Abruma la pigmentación clara y delicada.' },
    { hex: '#18181B', name: 'Negro Total', negativeEffect: 'Endurece y apaga facciones suaves.' },
  ],
  'Verano Suave (Soft Summer)': [
    { hex: '#FBBF24', name: 'Amarillo Neón', negativeEffect: 'Distorsiona la armonía fría y atenuada.' },
    { hex: '#C2410C', name: 'Naranja Teja', negativeEffect: 'Produce un efecto apagado y cansado en la tez.' },
  ],
  'Verano Frio (True Summer)': [
    { hex: '#D97706', name: 'Naranja Calabaza', negativeEffect: 'Genera discordancia con la base fría de la piel.' },
    { hex: '#CA8A04', name: 'Mostaza', negativeEffect: 'Acentúa tonos amarillentos no deseados.' },
  ],
  'Otono Suave (Soft Autumn)': [
    { hex: '#E11D48', name: 'Fucsia Neón', negativeEffect: 'Abruma los tonos suaves y apaga el rostro.' },
    { hex: '#1E40AF', name: 'Azul Eléctrico', negativeEffect: 'Rompe la armonía difuminada natural.' },
  ],
  'Otono Calido (True Autumn)': [
    { hex: '#E0E7FF', name: 'Azul Hielo Frío', negativeEffect: 'Genera sombras grisáceas bajo el mentón.' },
    { hex: '#64748B', name: 'Gris Asfalto Frío', negativeEffect: 'Apaga la vitalidad y luminosidad del cutis.' },
  ],
  'Otono Fuerte (Deep Autumn)': [
    { hex: '#F472B6', name: 'Rosa Pastel Frío', negativeEffect: 'Deslava el tono y resta presencia a las facciones.' },
    { hex: '#38BDF8', name: 'Azul Celeste Glaciar', negativeEffect: 'Crea una apariencia pálida y cansada.' },
  ],
  'Invierno Brillante (Clear Winter)': [
    { hex: '#EA580C', name: 'Naranja Óxido', negativeEffect: 'Genera reflejos cetrinos en el cuello y rostro.' },
    { hex: '#D6C7B2', name: 'Beige Apagado', negativeEffect: 'Deslava el contraste nítido de la mirada.' },
  ],
  'Invierno Frio (True Winter)': [
    { hex: '#CA8A04', name: 'Mostaza Dorado', negativeEffect: 'Acentúa sombras bajo los ojos y desluce la piel.' },
    { hex: '#78350F', name: 'Café Camel', negativeEffect: 'Hace que el cutis luzca apagado y sin vitalidad.' },
  ],
  'Invierno Fuerte (Deep Winter)': [
    { hex: '#FBBF24', name: 'Amarillo Cálido Claro', negativeEffect: 'Resta profundidad a las facciones.' },
    { hex: '#FB923C', name: 'Naranja Melocotón', negativeEffect: 'Rompe la sofisticación fría del cutis.' },
  ],

  // Fallbacks generales
  Invierno: [
    {
      hex: '#B45309',
      name: 'Mostaza Cálido',
      negativeEffect: 'Genera un reflejo cetrino en el cuello y acentúa sombras bajo los ojos.',
    },
    {
      hex: '#D97706',
      name: 'Naranja Óxido',
      negativeEffect: 'Rompe la armonía fría de tu piel, haciéndola lucir cansada o rojiza.',
    },
    {
      hex: '#D6D3D1',
      name: 'Beige Apagado',
      negativeEffect: 'Le resta contraste a tu iris y deslava la definición de tu mandíbula.',
    },
  ],
  Verano: [
    {
      hex: '#000000',
      name: 'Negro Azabache',
      negativeEffect: 'Crea una línea de corte demasiado dura que endurece y avejenta facciones suaves.',
    },
    {
      hex: '#EA580C',
      name: 'Naranja Neón',
      negativeEffect: 'Abruma tu pigmentación clara, haciendo que solo se vea la prenda y no tu rostro.',
    },
  ],
  Otono: [
    {
      hex: '#E11D48',
      name: 'Fucsia Neón Azulado',
      negativeEffect: 'Choca directamente con el subtono dorado de tu piel, dejándola pálida y fría.',
    },
    {
      hex: '#64748B',
      name: 'Gris Plomo',
      negativeEffect: 'Apaga el brillo natural de tu cutis, dándole un aspecto grisáceo.',
    },
  ],
  Primavera: [
    {
      hex: '#334155',
      name: 'Gris Pizarra Oscuro',
      negativeEffect: 'Apaga la vitalidad dorada y hace que la piel luzca pesada y sin luz.',
    },
    {
      hex: '#881337',
      name: 'Vino Tinto Frío',
      negativeEffect: 'Demasiado denso y frío para la calidez luminosa de tu rostro.',
    },
  ],
};

export const ACTION_PALETTES_DEFAULT: ActionPalettes = {
  baseWardrobe: [
    { hex: '#0F172A', name: 'Azul Marino Noche', category: 'base', usageTip: 'Ideal para abrigos y trajes formales' },
    { hex: '#000000', name: 'Negro Azabache', category: 'base', usageTip: 'Estructura la silueta en pantalones y blazers' },
    { hex: '#FFFFFF', name: 'Blanco Óptico', category: 'base', usageTip: 'Camisas y prendas superiores cerca al rostro' },
    { hex: '#334155', name: 'Gris Carbón', category: 'neutro', usageTip: 'Prendas de transición y calzado de calidad' },
  ],
  powerColors: [
    { hex: '#BE123C', name: 'Rojo Carmesí Frío', category: 'acento', usageTip: 'Tu color de máxima autoridad y liderazgo' },
    { hex: '#1D4ED8', name: 'Azul Zafiro Real', category: 'acento', usageTip: 'Genera confianza inmediata en entrevistas' },
    { hex: '#701A75', name: 'Magenta Profundo', category: 'acento', usageTip: 'Eventos sociales y cenas nocturnas' },
  ],
  beautyAndMetals: {
    lipsticks: [
      'Cherry Frío con base azulada',
      'Vino Tinto Profundo (Bordeaux)',
      'Fucsia Frío Satinado',
      'Nude Frío con matiz malva',
    ],
    metals: ['Plata 925', 'Oro Blanco', 'Platino'],
    glassesFrameColors: ['Acetato Negro Brillante', 'Plata Titanio', 'Azul Marino Intenso'],
  },
};

export const MUNSELL_COORDINATES_DEFAULT: MunsellCoordinates = {
  temperatureScore: -75, // Altamente frío
  valueScore: 35,        // Profundo/Oscuro
  chromaScore: 85,       // Altamente brillante y puro
  dominantDimension: 'Temperatura',
};

export const CONTRAST_METRIC_DEFAULT: ContrastMetric = {
  deltaL: 68,
  level: 'Alto Contraste',
  stylingRule:
    'Color Blocking obligatorio (Blanco + Negro, Zafiro + Carmesí). Evita looks monocromáticos apagados que te resten luminosidad.',
};

export const DEFAULT_PALETTE = SEASON_PALETTES['Invierno'];

export const getSeasonGroup = (season: ColorSeason): string => {
  if (season.includes('Invierno')) return 'Invierno';
  if (season.includes('Verano')) return 'Verano';
  if (season.includes('Otono')) return 'Otono';
  return 'Primavera';
};
