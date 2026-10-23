// Contenido de la ficha de cada producto (la misma pantalla sirve para el producto real y los ficticios).
import type { BoxTextures } from '@/components/PhotoBox3D';
import { colors, packColors } from '@/theme';
import { labLabel, type Product } from './mock';
import { CORAESSENS, vitrinaCards, type VitrinaCard, type VitrinaMode } from './vitrina';

export interface FichaPal {
  main: string; // color fuerte (tarjetas, cifras, títulos gigantes sobre fondo claro)
  mainDeep: string; // canto de la caja y sombras del color fuerte
  bg: string; // fondo oscuro (portada y cierre)
  bgDeep: string;
  paper: string; // fondo claro de las secciones
  line: string; // líneas finas y puntos inactivos
  ink: string; // texto sobre fondo claro
  giant: string; // texto gigante sobre el fondo oscuro
  veil: string; // velo blanco sobre el fondo oscuro
  veilLine: string;
}

/** Colores: los del empaque si el producto tiene fotos; si no, el tono del producto con los de Multi LAB */
export function fichaPalette(p: Product): FichaPal {
  if (p.photo) {
    const C = packColors.coraessens;
    return { main: C.red, mainDeep: C.redDeep, bg: C.purple, bgDeep: C.purpleDeep, paper: C.blush, line: C.line, ink: C.ink, giant: C.red, veil: C.veil, veilLine: C.veilLine };
  }
  const main = p.hue === colors.turquesa ? colors.primary : p.hue;
  return {
    main,
    mainDeep: main === colors.petroleo ? colors.petroleoDeep : colors.primaryPressed,
    bg: colors.petroleo,
    bgDeep: colors.petroleoDeep,
    paper: colors.bg,
    line: colors.border,
    ink: colors.ink,
    giant: colors.primary,
    veil: packColors.coraessens.veil,
    veilLine: packColors.coraessens.veilLine,
  };
}

export interface FichaContent {
  name: string;
  mark: string;
  labLine: string;
  disclaimer: string;
  formula: string;
  badges: string[];
  stamp: string; // sello blanco (muestra / ficticio)
  cards: VitrinaCard[];
  facts: { value: string; label: string; note: string }[];
  notes: { title: string; text: string }[];
  textures?: BoxTextures;
  ar: { id: string; name: string; arTitle?: string };
  cardId: string | null; // tarjeta impresa de AR
  hasModes: boolean; // nombre real / ficticio
}

/** cifras grandes: las del producto o, si no tiene, armadas con sus datos */
export function specsOf(p: Product) {
  if (p.specs?.length) return p.specs;
  const qty = p.form.match(/(\d+(?:[.,]\d+)?)\s?(ml|g|mg|cápsulas)/i);
  return [
    { value: qty ? `${qty[1]} ${qty[2]}` : p.form.split('·')[0].trim(), label: 'Presentación', note: p.form },
    { value: p.component.split(' ')[0], label: 'Componente principal', note: p.component },
    { value: p.concentration === 'No aplica' ? '—' : p.concentration, label: 'Concentración', note: p.concentration === 'No aplica' ? 'No aplica a este producto' : 'Por unidad' },
  ];
}

export function fichaContent(p: Product, mode: VitrinaMode): FichaContent {
  if (p.photo && p.id === CORAESSENS.id) {
    const n = CORAESSENS.names[mode];
    return {
      name: n.name,
      mark: n.mark,
      labLine: n.labLine,
      disclaimer: n.disclaimer,
      formula: CORAESSENS.formula,
      badges: CORAESSENS.badges,
      stamp: CORAESSENS.sample,
      cards: vitrinaCards(mode),
      facts: specsOf(p),
      notes: p.notes ?? [],
      textures: CORAESSENS.textures[mode],
      ar: { id: n.arId, name: n.name, arTitle: n.arTitle },
      cardId: mode === 'real' ? CORAESSENS.id : null,
      hasModes: true,
    };
  }
  // productos ficticios: las tarjetas siguen las caras dibujadas en su caja 3D
  const cards: VitrinaCard[] = [
    { id: 'frente', title: p.name, kicker: 'Frente', face: 'front', tone: 'red', body: `${p.tagline}. ${p.description}` },
    { id: 'datos', title: 'Datos del producto', kicker: 'Ficha', face: 'front', tone: 'purple', rows: [
      { label: 'Laboratorio', value: labLabel(p) },
      { label: 'Presentación', value: p.form.split('·')[1]?.trim() ?? p.form },
      { label: 'Componente', value: p.component.replace(' (ilustrativo)', '') },
      { label: 'Concentración', value: p.concentration },
    ] },
    { id: 'modo', title: 'Modo de uso', kicker: 'Reverso', face: 'back', tone: 'red', rows: p.howTo.map((h, i) => ({ label: `${i + 1}. ${h}`, value: '' })) },
    { id: 'avisos', title: 'Precauciones', kicker: 'Reverso', face: 'back', tone: 'purple', rows: p.precautions.map((h) => ({ label: h, value: '' })) },
    { id: 'usos', title: 'Usos descritos', kicker: 'Lateral', face: 'right', tone: 'red', rows: p.uses.map((u) => ({ label: u, value: '' })), foot: 'Texto de ejemplo: no corresponde a indicaciones aprobadas.' },
  ];
  return {
    name: p.name,
    mark: p.name,
    labLine: `${p.lab} · laboratorio ficticio`,
    disclaimer: 'Producto, laboratorio y datos ficticios para el prototipo académico Multi LAB. Textos de ejemplo: no son indicaciones aprobadas.',
    formula: p.tagline,
    badges: [p.category, ...p.form.split('·').map((x) => x.trim()).filter(Boolean)].slice(0, 3),
    stamp: 'Producto ficticio',
    cards,
    facts: specsOf(p),
    notes: p.uses.map((u, i) => ({ title: `Uso ${i + 1}`, text: u })),
    ar: p,
    cardId: p.id,
    hasModes: false,
  };
}
