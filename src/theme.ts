// Sistema visual Multi LAB
// Los tres colores de marca vienen del Manual de Marca (pág. 10).
// Neutros y colores de estado son una extensión para la interfaz.

export const brand = {
  teal: '#1E7F8C', // Teal / turquesa oscuro — color principal, acciones
  petroleo: '#20343A', // Azul petróleo oscuro — texto y fondos oscuros
  turquesa: '#63C9D6', // Turquesa claro — acentos (nunca como color de texto)
};

export const colors = {
  ...brand,
  primary: brand.teal,
  primaryPressed: '#176874',
  primarySoft: '#E4F3F5',
  accentSoft: '#E6F7F9',
  ink: brand.petroleo,
  inkMuted: '#5B6E74',
  inkSubtle: '#8A9A9F',
  bg: '#F4F7F8',
  surface: '#FFFFFF',
  border: '#DCE5E7',
  borderStrong: '#C3D2D5',
  white: '#FFFFFF',
  success: '#2F7D4F',
  successSoft: '#E6F4EC',
  warning: '#9A6200',
  warningSoft: '#FCF1DC',
  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  petroleoDeep: '#14242A', // fondo oscuro de la ficha (degradado con el petróleo)
  overlay: 'rgba(32, 52, 58, 0.55)',
  glass: 'rgba(255, 255, 255, 0.9)', // interior de la burbuja de vidrio
  clear: 'rgba(255, 255, 255, 0)',
};

export const font = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const type = {
  h1: { fontFamily: font.bold, fontSize: 26, lineHeight: 32, color: colors.ink },
  h2: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, color: colors.ink },
  h3: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyMuted: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, color: colors.ink },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  overline: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: colors.primary,
  },
};

export const shadow = {
  card: {
    shadowColor: '#20343A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

// Colores del empaque de cada producto de la vitrina 3D (tomados de las fotos del producto).
// Solo se usan dentro de su vitrina; el resto de la app sigue con los colores de marca.
export const packColors = {
  coraessens: {
    red: '#C9262F',
    redDeep: '#99161F',
    purple: '#5C2C78',
    purpleDeep: '#341447',
    blush: '#FBEDEE', // fondo claro de las secciones
    line: '#E9C9CD', // líneas topográficas del fondo
    ink: '#2B1236', // texto sobre fondo claro
    veil: 'rgba(255, 255, 255, 0.16)', // velo blanco sobre el morado (chips, botones)
    veilLine: 'rgba(255, 255, 255, 0.4)',
  },
};
