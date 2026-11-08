// Textos de PANCREOGEN® transcritos del frasco (sin imágenes), para la app y para los scripts que generan
// la ficha en PDF y la tarjeta impresa. Producto real de Nutrabiotics, mostrado con permiso del laboratorio.
// No agregues indicaciones ni afirmaciones que no estén impresas en el frasco. La etiqueta de lote del
// frasco fotografiado trae un precio de venta: no se transcribe (la app no vende ni dispensa).
import type { VitrinaMode, VitrinaNames } from './coraessens-info';

export interface PanSpot {
  id: string;
  /** posición en la etiqueta desenrollada: u = vuelta (0,5 = frente), v = altura (0 = borde de la tapa, 1 = base) */
  u: number;
  v: number;
  kicker: string;
  title: string;
  body: string;
  /** solo en un modo (el ficticio tapa la marca y el fabricante) */
  only?: VitrinaMode;
}

export interface NutrientRow {
  name: string;
  qty: string;
  unit: string;
  vdr: string; // %VDR tal como está impreso ('*' = no establecido)
}

export const PANCREOGEN_INFO = {
  id: 'pan',
  // proporciones medidas en las fotos: diámetro 4 cm (aprox.), cuerpo 9,6 cm y tapa 2,8 cm
  sizeCm: { w: 4, h: 12.4, d: 4 },
  names: {
    real: {
      name: 'PANCREOGEN',
      mark: 'PANCREOGEN®',
      lab: 'Nutrabiotics',
      labLine: 'Nutrabiotics · con ciencia nutricional',
      disclaimer:
        'Producto real de Nutrabiotics, mostrado con permiso del laboratorio. La información está tomada del frasco y no reemplaza su ficha técnica.',
      arTitle: 'PANCREOGEN · Nutrabiotics',
      arId: 'pan',
    },
    ficticio: {
      name: 'PANCRIVA',
      mark: 'PANCRIVA',
      lab: 'Bioandes',
      labLine: 'Bioandes · laboratorio ficticio',
      disclaimer:
        'Versión con nombre y laboratorio ficticios para el prototipo académico. Se usa el mismo frasco fotografiado como ejemplo.',
      arTitle: 'PANCRIVA · producto ficticio',
      arId: 'pan-f',
    },
  } as Record<VitrinaMode, VitrinaNames>,
  formula: 'Fórmula a base de menudo (páncreas) bovino liofilizado, vitaminas y minerales esenciales',
  badges: ['90 cápsulas', 'Suplemento dietario', 'Producto de venta libre'],
  capsules: 90,
  serving: 'Tamaño de la porción diaria: 3 cápsulas',
  servings: 'Porciones por envase: 30',
  net: 'Contenido neto: 48,3 g (90 cápsulas de 537,56 mg)',
  howTo: 'Vía oral: Adultos mayores de 18 años tomar 1 cápsula 3 veces al día.',
  description:
    'Suplemento alimenticio en cápsulas a base de polvo liofilizado de páncreas bovino, canela, vitaminas y minerales esenciales.',
  // composición por cápsula / ingredientes, en el orden del frasco
  ingredients: [
    { name: 'Polvo liofilizado de páncreas bovino' },
    { name: 'Cápsula', detail: 'Gelatina, agua, lauril sulfato de sodio' },
    { name: 'Canela en polvo', detail: 'Cinnamomum zeylanicum L.' },
    { name: 'Manganeso gluconato anhidro', detail: 'Eq. a 2,75 mg de Mn' },
    { name: 'Celulosa microcristalina' },
    { name: 'Zinc citrato anhidro', detail: 'Eq. a 5,13 mg de Zn' },
    { name: 'Palmitato de ascorbilo', detail: 'Eq. a 4,25 mg de vitamina C' },
    { name: 'Dióxido de silicio' },
    { name: 'Estearato de magnesio vegetal' },
    { name: 'Vitamina D3', detail: 'Eq. a 650 UI de vitamina D' },
    { name: 'Cromo cloruro hexahidrato', detail: 'Eq. a 195,1 mcg de Cr' },
    { name: 'Biotina' },
    { name: 'Vanadato de sodio anhidro', detail: 'Eq. a 16,61 mcg de Vn' },
  ] as { name: string; detail?: string }[],
  nutrition: [
    { name: 'Energía (Calorías)', qty: '<1', unit: 'kcal/kJ', vdr: '0' },
    { name: 'Vitamina C', qty: '12,75', unit: 'mg', vdr: '21,25' },
    { name: 'Vitamina D', qty: '48,74', unit: 'mcg', vdr: '975' },
    { name: 'Biotina', qty: '600', unit: 'mcg', vdr: '200' },
    { name: 'Cromo', qty: '585,3', unit: 'mcg', vdr: '488' },
    { name: 'Manganeso', qty: '8,25', unit: 'mg', vdr: '413' },
    { name: 'Zinc', qty: '15,39', unit: 'mg', vdr: '103' },
    { name: 'Vanadio', qty: '49,84', unit: 'mcg', vdr: '*' },
  ] as NutrientRow[],
  nutritionNote:
    '*Valor Diario de referencia (%VD) no establecido. Valores de referencia de nutrientes para una dieta de 8380 kJ (2000 kcal).',
  warnings: [
    'Manténgase fuera del alcance de los niños.',
    'El producto no es adecuado para ser consumido como única fuente de alimento.',
    'No superar la dosis recomendada.',
    'Almacénese en un lugar fresco y seco en su envase y empaque original.',
    'No use el producto si el sello de seguridad está roto o despegado.',
  ],
  vitaminD: ['La vitamina D ayuda al organismo a utilizar el calcio y el fósforo.', 'PANCREOGEN contiene dentro de su formulación vitamina D.'],
  maker: [
    'Fabricado por Laboratorios Quipropharma S.A.S., Bogotá D.C., Colombia, Carrera 22 # 164-42, para Nutrabiotics S.A.S.',
    'Importado y distribuido en Ecuador por Moléculas Biológicas Biomolec Cía. Ltda., Av. Eugenio Espejo #2410 y Rincón del Valle, Quito, Ecuador.',
  ],
  registry: 'Notificación Sanitaria 10846-ALE-0819',
  web: 'www.nutrabiotics.info',
};

/** Puntos interactivos sobre el frasco (posición medida en la etiqueta desenrollada). */
export function panSpots(mode: VitrinaMode): PanSpot[] {
  const I = PANCREOGEN_INFO;
  const n = I.names[mode];
  const spots: PanSpot[] = [
    { id: 'marca', u: 0.352, v: 0.17, kicker: 'Frente', title: mode === 'real' ? 'Nutrabiotics®' : 'Bioandes', body: mode === 'real' ? 'Con ciencia nutricional. Laboratorio del producto.' : 'Laboratorio ficticio del prototipo académico: tapa la marca real.' },
    { id: 'nombre', u: 0.655, v: 0.375, kicker: 'Frente', title: n.mark, body: I.formula + '.' },
    { id: 'capsulas', u: 0.44, v: 0.765, kicker: 'Frente', title: '90 cápsulas', body: `Suplemento dietario. ${I.net}.` },
    { id: 'composicion', u: 0.72, v: 0.2, kicker: 'Lateral', title: 'Composición por cápsula', body: `${I.ingredients.length} ingredientes, encabezados por el polvo liofilizado de páncreas bovino.` },
    { id: 'nutricional', u: 0.72, v: 0.5, kicker: 'Lateral', title: 'Información nutricional', body: `${I.serving}. ${I.servings}.` },
    { id: 'modo', u: 0.012, v: 0.45, kicker: 'Reverso', title: 'Modo de empleo', body: I.howTo },
    { id: 'registro', u: 0.138, v: 0.3, kicker: 'Reverso', title: mode === 'real' ? 'Fabricante y registro' : 'Producto ficticio', body: mode === 'real' ? `${I.registry}. Fabricado por Laboratorios Quipropharma S.A.S. (Colombia).` : 'En la versión ficticia el fabricante y el código de barras están tapados.' },
    { id: 'relieve', u: 0.24, v: 0.55, kicker: 'Reverso', title: mode === 'real' ? 'Marca en relieve' : 'Frasco liso', body: mode === 'real' ? 'El plástico blanco lleva «Nutrabiotics» en relieve, del lado opuesto al frente.' : 'En la versión ficticia el relieve de la marca se quitó del frasco.' },
  ];
  return spots;
}

/** Tablas del frasco con la misma forma que las tarjetas de CORAESSENS (para la ficha en PDF). */
export function panCards() {
  const I = PANCREOGEN_INFO;
  return [
    {
      id: 'composicion',
      title: 'Composición por cápsula',
      rows: I.ingredients.map((g) => ({ label: g.detail ? `${g.name} (${g.detail})` : g.name, value: '' })),
    },
    {
      id: 'nutricional',
      title: 'Información nutricional',
      rowsHead: ['Por porción diaria (3 cápsulas)', 'Cantidad', '%VDR'],
      rows: I.nutrition.map((r) => ({ label: r.name, value: `${r.qty} ${r.unit}`, extra: r.vdr })),
      foot: `${I.servings}. ${I.nutritionNote}`,
    },
    { id: 'fabricante', title: 'Fabricante', body: I.maker.join(' '), foot: `${I.registry}. ${I.net}.` },
  ];
}
