export interface PenpotColorTokens {
  ink: {
    900: string; // #241F26: Texto principal · superficies oscuras
    700: string; // #4A454E: Texto intermedio y etiquetas
    600: string; // #5F5254: Texto secundario (rediseño, 6,27:1 sobre el fondo)
    400: string; // #A5A2A8: Texto deshabilitado
    300: string; // #777479: Icono inactivo sobre oscuro
  };
  accent: {
    500: string; // #E8899F: Acento de marca (relleno, no texto)
  };
  surface: {
    card: string; // rgba(255, 255, 255, 0.68): Blanco al 68 % sobre el fondo
    input: string; // rgba(255, 255, 255, 0.68): Los campos comparten el fondo de la tarjeta
    solid: string; // #FFFFFF: Modales y hojas
    flat: string; // #FEF9F4: Lienzos de documentación y superficies claras
    overlay: string; // rgba(36, 31, 38, 0.50): Velo modal, tinta al 50 %
    modal: string; // #FFF6F0: Hojas inferiores y diálogos
    camera: string; // #241F26: Visor oscuro para cámara
    disabled: string; // rgba(255, 255, 255, 0.35): Superficie deshabilitada
    hintOverlay: string; // rgba(0, 0, 0, 0.4): Velo de indicaciones
  };
  border: {
    subtle: string; // rgba(36, 31, 38, 0.08): Tinta al 8 %
    medium: string; // rgba(36, 31, 38, 0.20): Borde de campo
    focus: string; // #8F3A52: Foco (vino)
    error: string; // #9E3B25
    active: string; // #241F26
    glass: string; // rgba(255, 255, 255, 0.9): Borde de tarjeta y separadores
    white: string; // #FFFFFF
  };
  state: {
    success: string; // #4F6B2E: Texto sobre confirmación
    successBg: string; // rgba(122, 132, 80, 0.28): Fondo verde oliva/éxito
    warning: string; // #D9A441: Aviso (relleno; para texto usar text.warning)
    warningBg: string; // rgba(217, 164, 65, 0.34)
    danger: string; // #9E3B25: Error y borrado
    dangerBg: string; // rgba(181, 72, 46, 0.20): Fondo suave de error/peligro
    info: string; // #4F6BED
    infoBg: string; // rgba(255, 255, 255, 0.5)
    copperBg: string; // rgba(201, 123, 74, 0.15): Fondo suave terracota/cobre
  };
  background: {
    gradient: readonly [string, string]; // ['#FBE8DD', '#F6D3E0']: vertical, único fondo de la app
    solid: string; // #FBE8DD
  };
  palette: {
    // Otoño cálido
    copper: string; // #C97B4A
    copperLight: string; // #D68F63
    copperDark: string; // #B06535
    coffee: string; // #8E5B4A: «Chocolate» en prendas
    ochre: string; // #D9A441
    olive: string; // #7A8450
    brick: string; // #B5482E
    terracotta: string; // #B5593B
    camel: string; // #C19A6B
    plum: string; // #7A3B52
    // Neutros
    cream: string; // #F3E3C8
    sand: string; // #D6C5B0
    beige: string; // #D8C3A5
    ivory: string; // #FAF4EA
    taupe: string; // #6E5C4B
    charcoal: string; // #3E3A36
    darkChocolate: string; // #5C3D2E
    // Biometría
    skinWarm: string; // #D6A476
    // Colores a evitar
    avoidCold: string; // #4F6BED (azules fríos)
    avoidPink: string; // #D94A8A (fucsia)
    avoidSilver: string; // #B8C4CF (gris frío)
    petrol: string; // #3E5C6B
    // Acentos adicionales
    forestGreen: string; // #3F5B3A
    amber: string; // #E5A93C
  };
  /** Rampa de tono de piel del indicador de «Tono y subtono», de claro a profundo. */
  skinRamp: readonly string[];
}

export const penpotTokens: PenpotColorTokens = {
  // Propuesta P1 «Coral amanecer» (design.md, sección 33)
  ink: {
    900: '#2A1714',
    700: '#4A2C27',
    600: '#664A44',
    400: '#A08A85',
    300: '#8A6F69',
  },
  accent: {
    500: '#FF6F61',
  },
  surface: {
    card: '#FFFFFF',
    input: '#FFFFFF',
    solid: '#FFFFFF',
    flat: '#FFF7F1',
    overlay: 'rgba(42, 23, 20, 0.5)',
    modal: '#FFF7F1',
    camera: '#2A1714',
    disabled: 'rgba(255, 255, 255, 0.45)',
    hintOverlay: 'rgba(0, 0, 0, 0.4)',
  },
  border: {
    subtle: 'rgba(42, 23, 20, 0.08)',
    medium: 'rgba(42, 23, 20, 0.22)',
    focus: '#B3392E',
    error: '#B42318',
    active: '#2A1714',
    glass: '#FFFFFF',
    white: '#FFFFFF',
  },
  state: {
    success: '#4F6B2E',
    successBg: 'rgba(122, 132, 80, 0.22)',
    warning: '#D9A441',
    warningBg: 'rgba(217, 164, 65, 0.28)',
    danger: '#B42318',
    dangerBg: '#FDE7E4',
    info: '#4F6BED',
    infoBg: 'rgba(255, 255, 255, 0.6)',
    copperBg: 'rgba(201, 123, 74, 0.15)',
  },
  background: {
    gradient: ['#FFF7F1', '#FFE8E0'] as const,
    solid: '#FFF7F1',
  },
  palette: {
    copper: '#C97B4A',
    copperLight: '#D68F63',
    copperDark: '#B06535',
    coffee: '#8E5B4A',
    ochre: '#D9A441',
    olive: '#7A8450',
    brick: '#B5482E',
    terracotta: '#B5593B',
    camel: '#C19A6B',
    plum: '#7A3B52',
    cream: '#F3E3C8',
    sand: '#D6C5B0',
    beige: '#D8C3A5',
    ivory: '#FAF4EA',
    taupe: '#6E5C4B',
    charcoal: '#3E3A36',
    darkChocolate: '#5C3D2E',
    skinWarm: '#D6A476',
    avoidCold: '#4F6BED',
    avoidPink: '#D94A8A',
    avoidSilver: '#B8C4CF',
    petrol: '#3E5C6B',
    forestGreen: '#3F5B3A',
    amber: '#E5A93C',
  },
  skinRamp: ['#F6E0D2', '#E9C4A5', '#CFA07A', '#A8744F', '#7A4B33', '#4B2C20'],
};

export interface ThemeColors {
  isDark: boolean;
  penpot: PenpotColorTokens;
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
    surfaceElevated: string;
    overlay: string;
    /** Dos halos decorativos del fondo (rosa a la izquierda, ocre a la derecha). */
    halos: readonly [string, string];
  };
  brand: {
    primary: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    /** Rosa suave para fondo de iconos, pasos y etiquetas informativas. */
    accentSoft: string;
    cyan: string;
    emerald: string;
    neonGreen: string;
  };
  gradients: {
    auraGlow: readonly [string, string, ...string[]];
    goldGlow: readonly [string, string, ...string[]];
    cyberGlow: readonly [string, string, ...string[]];
    darkSurface: readonly [string, string, ...string[]];
    cardBorder: readonly [string, string, ...string[]];
    /** Tarjeta de resultado; el texto encima es siempre `#241F26`. */
    hero: readonly [string, string, ...string[]];
    /** Relleno de barras de confianza y Style DNA. */
    barFill: readonly [string, string, ...string[]];
    /** Fondo de las pantallas de captura (radial, de centro a borde). */
    camera: readonly [string, string, ...string[]];
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    accent: string;
    danger: string;
    /** Texto de advertencia con contraste suficiente. */
    warning: string;
    /** Texto sobre el botón destructivo. */
    onDanger: string;
    copper: string;
    olive: string;
  };
  border: {
    subtle: string;
    medium: string;
    active: string;
    gold: string;
    focus: string;
    error: string;
    glass: string;
    white: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  state: {
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
    danger: string;
    dangerBg: string;
    info: string;
    infoBg: string;
    copperBg: string;
  };
  ink: {
    900: string;
    700: string;
    600: string;
    400: string;
    300: string;
  };
  surface: {
    card: string;
    input: string;
    solid: string;
    flat: string;
    overlay: string;
    modal: string;
    camera: string;
    disabled: string;
    hintOverlay: string;
    /** Barra de pestañas flotante. */
    tabBar: string;
  };
  tabBar: {
    bubble: readonly [string, string];
    bubbleIcon: string;
    ripple: string;
    burst: string;
  };
  switch: {
    trackOff: string;
    trackOn: string;
    thumb: string;
  };
  /** Colores sobre las pantallas de cámara, que son oscuras en ambos temas. */
  camera: {
    ink: string;
    ink2: string;
    card: string;
    line: string;
    guide: string;
    scan: string;
  };
  copper: {
    400: string;
    500: string;
    600: string;
  };
  olive: {
    500: string;
  };
  danger: {
    500: string;
  };
  accent: {
    500: string;
  };
  palette: PenpotColorTokens['palette'];
  skinRamp: PenpotColorTokens['skinRamp'];
}

const sharedTabBar = {
  ripple: '#FF6F61',
  burst: 'rgba(255, 111, 97, 0.22)',
};

const sharedSwitch = {
  trackOff: 'rgba(102, 74, 68, 0.4)',
  trackOn: '#B3392E',
  thumb: '#FFFFFF',
};

const sharedCamera = {
  ink: '#FFFFFF',
  ink2: '#F3DDD5',
  card: 'rgba(255, 255, 255, 0.14)',
  line: 'rgba(255, 255, 255, 0.22)',
  guide: '#FF9B7B',
  scan: '#FF6F61',
};

// Gradiente del héroe P1: el texto encima es siempre la tinta `#2A1714` (6,3:1 en el coral más intenso).
const sharedGradients = {
  hero: ['#FF6F61', '#FF9B7B', '#FFD5A1'] as const,
  barFill: ['#FF6F61', '#FFB27A'] as const,
  camera: ['#4A2C27', '#2A1714'] as const,
};

const sharedHalos = ['rgba(255, 111, 97, 0.11)', 'rgba(255, 213, 161, 0.26)'] as const;

// Tema claro: propuesta P1 «Coral amanecer» (design.md, sección 33)
export const lightColors: ThemeColors = {
  isDark: false,
  penpot: penpotTokens,
  background: {
    primary: '#FFF7F1',
    secondary: '#FFFFFF',
    tertiary: '#FFF7F1',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    overlay: 'rgba(42, 23, 20, 0.5)',
    halos: sharedHalos,
  },
  brand: {
    primary: '#2A1714',
    primaryLight: '#4A2C27',
    secondary: '#FF6F61',
    accent: '#FF6F61',
    accentSoft: 'rgba(255, 111, 97, 0.18)',
    cyan: '#7A8450',
    emerald: '#2F5E4A',
    neonGreen: '#00E676',
  },
  gradients: {
    auraGlow: ['#FFF7F1', '#FFE8E0'] as const,
    goldGlow: ['#FFB27A', '#FF6F61'] as const,
    cyberGlow: ['#C9EAD9', '#7A8450'] as const,
    darkSurface: ['#FFFFFF', '#FFF7F1'] as const,
    cardBorder: ['rgba(255, 111, 97, 0.3)', 'rgba(42, 23, 20, 0.08)', 'transparent'] as const,
    ...sharedGradients,
  },
  text: {
    primary: '#2A1714',
    secondary: '#664A44',
    muted: '#7A5F59',
    inverse: '#FFFFFF',
    accent: '#B3392E',
    danger: '#B42318',
    warning: '#8A5A00',
    onDanger: '#FFFFFF',
    copper: '#96502A',
    olive: '#5E6A35',
  },
  border: {
    subtle: 'rgba(42, 23, 20, 0.08)',
    medium: 'rgba(42, 23, 20, 0.22)',
    active: '#2A1714',
    gold: '#D9A441',
    focus: '#2A1714',
    error: '#B42318',
    glass: '#FFFFFF',
    white: '#FFFFFF',
  },
  status: {
    success: '#4F6B2E',
    warning: '#D9A441',
    error: '#B42318',
    info: '#4F6BED',
  },
  state: penpotTokens.state,
  ink: penpotTokens.ink,
  surface: {
    ...penpotTokens.surface,
    tabBar: '#FFFFFF',
  },
  tabBar: {
    bubble: ['#FF8A73', '#FF6F61'] as const,
    bubbleIcon: '#2A1714',
    ...sharedTabBar,
  },
  switch: sharedSwitch,
  camera: sharedCamera,
  copper: {
    400: penpotTokens.palette.copperLight,
    500: penpotTokens.palette.copper,
    600: penpotTokens.palette.copperDark,
  },
  olive: {
    500: penpotTokens.palette.olive,
  },
  danger: {
    500: penpotTokens.state.danger,
  },
  accent: penpotTokens.accent,
  palette: penpotTokens.palette,
  skinRamp: penpotTokens.skinRamp,
};

// Tema oscuro P1: superficies vino oscuro y acentos coral claros.
export const darkColors: ThemeColors = {
  isDark: true,
  penpot: penpotTokens,
  background: {
    primary: '#241619',
    secondary: '#2E1C1F',
    tertiary: '#3A262B',
    surface: '#3A262B',
    surfaceElevated: '#3A262B',
    overlay: 'rgba(0, 0, 0, 0.6)',
    halos: ['rgba(255, 111, 97, 0.14)', 'rgba(255, 155, 123, 0.12)'] as const,
  },
  brand: {
    primary: '#FF9B7B',
    primaryLight: '#FFC2AE',
    secondary: '#FF6F61',
    accent: '#FF9B7B',
    accentSoft: 'rgba(255, 155, 123, 0.2)',
    cyan: '#7A8450',
    emerald: '#C9EAD9',
    neonGreen: '#00E676',
  },
  gradients: {
    auraGlow: ['#241619', '#2E1C1F'] as const,
    goldGlow: ['#FF9B7B', '#C9604F'] as const,
    cyberGlow: ['#7A8450', '#2F5E4A'] as const,
    darkSurface: ['#3A262B', '#2E1C1F'] as const,
    cardBorder: ['rgba(255, 155, 123, 0.4)', 'rgba(255, 255, 255, 0.08)', 'transparent'] as const,
    ...sharedGradients,
  },
  text: {
    primary: '#FFF1EC',
    secondary: '#E3C6BE',
    muted: '#B9988F',
    inverse: '#2A1714',
    accent: '#FF9B85',
    danger: '#FF9F8A',
    warning: '#F0C36A',
    onDanger: '#2A1714',
    copper: '#E3A57A',
    olive: '#B7C48A',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.12)',
    medium: 'rgba(255, 255, 255, 0.26)',
    active: '#FF9B7B',
    gold: '#D9A441',
    focus: '#FF9B85',
    error: '#FF9F8A',
    glass: 'rgba(255, 255, 255, 0.14)',
    white: '#FFFFFF',
  },
  status: {
    success: '#B7D68A',
    warning: '#D9A441',
    error: '#FF9F8A',
    info: '#8FA2FF',
  },
  state: {
    ...penpotTokens.state,
    success: '#B7D68A',
    danger: '#FF9F8A',
    dangerBg: '#4A2620',
    successBg: 'rgba(122, 132, 80, 0.28)',
    copperBg: 'rgba(201, 123, 74, 0.25)',
  },
  ink: {
    900: '#FFF1EC',
    700: '#E3C6BE',
    600: '#C9A9A0',
    400: '#8F7069',
    300: '#5A4047',
  },
  surface: {
    card: '#3A262B',
    input: '#2E1C1F',
    solid: '#2E1C1F',
    flat: '#241619',
    overlay: 'rgba(0, 0, 0, 0.6)',
    modal: '#2E1C1F',
    camera: '#2A1714',
    disabled: 'rgba(255, 255, 255, 0.08)',
    hintOverlay: 'rgba(0, 0, 0, 0.6)',
    tabBar: '#3A262B',
  },
  tabBar: {
    bubble: ['#FF9B7B', '#FF6F61'] as const,
    bubbleIcon: '#2A1714',
    ...sharedTabBar,
  },
  switch: { ...sharedSwitch, trackOn: '#FF9B7B' },
  camera: sharedCamera,
  copper: {
    400: penpotTokens.palette.copperLight,
    500: penpotTokens.palette.copper,
    600: penpotTokens.palette.copperDark,
  },
  olive: {
    500: penpotTokens.palette.olive,
  },
  danger: {
    500: '#FF9F8A',
  },
  accent: penpotTokens.accent,
  palette: penpotTokens.palette,
  skinRamp: penpotTokens.skinRamp,
};

// Por defecto usamos lightColors; las pantallas deben leer el tema activo con useTheme().
export const colors = lightColors;
export const darkThemeColors = darkColors;
export const lightThemeColors = lightColors;
