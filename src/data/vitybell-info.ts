// Textos de VITYBELL® transcritos de la caja (sin imágenes), para la app y para los scripts.
// Producto real de Procaps, mostrado con permiso del laboratorio. Es una muestra gratuita: la app no la vende ni
// la entrega. No agregues indicaciones ni afirmaciones que no estén impresas en la caja. Se respeta la escritura de
// la caja (punto decimal: «0.810 g», «17.5 mg», «133.33%»; «Pantetonato» en la tabla y «pantotenato» en los
// ingredientes; «dioxido» sin tilde en uno de los colorantes).
import type { VitrinaMode, VitrinaNames } from './coraessens-info';

export interface VitNutrient {
  key: string;
  name: string; // como en el frente de la caja
  full: string; // como en la tabla de información nutricional
  amount: string;
  vdr: number; // % VDR por porción
  vdrText: string;
}

export const VITYBELL_INFO = {
  id: 'vit',
  // proporción medida en las fotos (ancho 1,62 : alto 1 : fondo 0,33); el tamaño en cm es aproximado
  dims: { w: 1.62, h: 1, d: 0.33 },
  sizeCm: { w: 7, h: 4.3, d: 1.4 },
  names: {
    real: {
      name: 'VITYBELL',
      mark: 'Vitybell®',
      lab: 'Procaps',
      labLine: 'Grupo Procaps · suplemento alimenticio',
      disclaimer:
        'Producto real de Procaps, mostrado con permiso del laboratorio. La información está tomada de la caja de la muestra gratuita.',
      arTitle: 'VITYBELL · Procaps',
      arId: 'vit',
    },
    ficticio: {
      name: 'FLORIVA',
      mark: 'Floriva',
      lab: 'Bioandes',
      labLine: 'Bioandes · laboratorio ficticio',
      disclaimer:
        'Versión con nombre y laboratorio ficticios para el prototipo académico. Se usa la misma caja fotografiada como ejemplo.',
      arTitle: 'FLORIVA · producto ficticio',
      arId: 'vit-f',
    },
  } as Record<VitrinaMode, VitrinaNames>,
  // frente de la caja
  tagline: 'Suplemento alimenticio en cápsula blanda a base de:',
  sample: 'MUESTRA GRATUITA',
  net: 'Contenido Neto: 4.050 g',
  netDetail: '(5 Cápsulas blandas x 0.810 g/Cápsula)',
  capsules: 5,
  // cantos de la caja (texto impreso, con sus marcas de verificación)
  claims: {
    cabello: 'El Zinc y la Biotina contribuyen al mantenimiento del cabello en condiciones normales.',
    unas: 'El Zinc contribuye al mantenimiento de las uñas en condiciones normales.',
  },
  // información nutricional (reverso), en el orden del frente
  serving: 'Porción: 1 Cápsula blanda (0.810 g). Porciones por envase: 5 Cápsulas blandas.',
  nutrients: [
    { key: 'biotina', name: 'Biotina', full: 'Biotina', amount: '900 µg', vdr: 300, vdrText: '300%' },
    { key: 'pantotenico', name: 'Ácido Pantoténico', full: 'Ácido Pantoténico (Como Pantetonato de Calcio)', amount: '3 mg', vdr: 30, vdrText: '30%' },
    { key: 'nicotinamida', name: 'Nicotinamida', full: 'Nicotinamida', amount: '17.5 mg', vdr: 97, vdrText: '97%' },
    { key: 'zinc', name: 'Zinc', full: 'Zinc (como Sulfato de Zinc monohidrato)', amount: '20 mg', vdr: 133.33, vdrText: '133.33%' },
    { key: 'cobre', name: 'Cobre', full: 'Cobre (como Sulfato de cobre anhidro)', amount: '0.1 mg', vdr: 5, vdrText: '5%' },
    { key: 'selenio', name: 'Selenio', full: 'Selenio (como L(+) Seleniometionina)', amount: '200 µg', vdr: 285.7, vdrText: '285.7%' },
    { key: 'riboflavina', name: 'Riboflavina', full: 'Riboflavina', amount: '0.8 mg', vdr: 50, vdrText: '50%' },
    { key: 'piridoxina', name: 'Piridoxina', full: 'Piridoxina (como Piridoxina Clorhidrato)', amount: '1 mg', vdr: 50, vdrText: '50%' },
  ] as VitNutrient[],
  zeros: [
    'Valor Energético 0 kcal (0 kJ) (0% VDR*)',
    'Grasa Total 0 g (0% VDR*)',
    'Colesterol 0 mg (0% VDR*)',
    'Sodio 0 mg (0% VDR*)',
    'Carbohidratos Totales 0 g (0% VDR*)',
    'Fibra Dietaria 0 g (0% VDR*)',
    'Azúcares 0 g (0% VDR*)',
    'Proteína 0 g (0% VDR*)',
  ],
  vdrNote: '*Los porcentajes de los valores diarios recomendados están basados en una dieta 8380 kJ (2000 kcal). No es una fuente significativa de grasa saturada.',
  ingredients:
    'cápsula de gelatina [gelatina (origen bovino y/o porcino), agua purificada USP, humectante (glicerina), humectante (solución de sorbitol-sorbitan (SPI)), colorante (candurin silver fine: silicato de potasio y aluminio, dióxido de titanio CI 77891), colorante (dioxido de titanio CI 77891), colorante (rojo N° 40 FD&C CI 16035), colorante (azul #1 FD&C CI 42090), colorante (rojo N° 3 FD&C CI 45430)], aceite de girasol (de origen vegetal), sulfato de zinc monohidrato (equivalente a 20 mg de zinc), softisan 378 (triglicéridos de ácido esteárico, caprílico, cáprico, mirístico), L(+) seleniometionina (5000 µg/g) (equivalente a 200 mcg de selenio), nicotinamida, espesante (cera de abejas blanca), pantotenato de calcio (equivalente a 3 mg de ácido pantotenico), antiaglutinante (dióxido de silicio coloidal), piridoxina clorhidrato (equivalente a 1 mg de piridoxina base), emulsionante (lecitina de soya), biotina, riboflavina, sulfato de cobre anhidro (equivalente a 0.1 mg de cobre), antioxidante (butilhidroxianisol), antioxidante (butilhidroxitolueno). Contiene soya.',
  route: 'Oral.',
  usage: 'Tomar una (1) cápsula al día.',
  warning: 'Puede causar hipersensibilidad a sus componentes.',
  maxDaily: 'Consumo máximo diario: 1 cápsula en 24 horas.',
  population: 'Adultos mayores de 18 años.',
  maker: 'Fabricado por PROCAPS S.A. Calle 80 No. 78B-201. Barranquilla – Colombia. INDUSTRIA COLOMBIANA.',
  registry: 'Notificación Sanitaria No. 14758-ALE-0121 Ecuador.',
  importer: 'Importado/Distribuido por: RODDOME PHARMACEUTICAL S.A., Dirección: Avenida 6 de Diciembre N 32-594 E Ignacio Bossano, Quito, Ecuador.',
  logos: ['GRUPO PROCAPS', 'PROCAPS', 'RODDOME'],
};

/** Grupos del listado de ingredientes que se pueden resaltar (palabras tal como están en la caja) */
export const VIT_GROUPS: { key: string; label: string; words: string[] }[] = [
  { key: 'colorante', label: 'Colorantes', words: ['colorante'] },
  { key: 'humectante', label: 'Humectantes', words: ['humectante'] },
  { key: 'antioxidante', label: 'Antioxidantes', words: ['antioxidante'] },
  { key: 'otros', label: 'Espesante, emulsionante y antiaglutinante', words: ['espesante', 'emulsionante', 'antiaglutinante'] },
  { key: 'soya', label: 'Contiene soya', words: ['soya'] },
];

/** Partes de la caja que se pueden mirar (la caja gira hasta dejarlas de frente) */
export interface VitFace {
  face: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
  label: string;
  title: string;
  body: string;
}

export function vitFaces(mode: VitrinaMode): VitFace[] {
  const I = VITYBELL_INFO;
  const n = I.names[mode];
  return [
    { face: 'front', label: 'Frente', title: n.mark, body: `${I.tagline} Biotina + Ácido Pantoténico + Nicotinamida + Zinc + Cobre + Selenio + Riboflavina + Piridoxina. ${I.net}.` },
    { face: 'back', label: 'Reverso', title: 'Información nutricional', body: 'Tabla por porción, listado de ingredientes, vía de administración, modo de uso, advertencia, población y fabricante.' },
    { face: 'top', label: 'Arriba', title: 'Cabello y uñas', body: `${I.claims.cabello} ${I.claims.unas}` },
    { face: 'bottom', label: 'Abajo', title: 'Canto inferior', body: 'Repite el nombre, los componentes y los dos textos sobre cabello y uñas.' },
    { face: 'left', label: 'Lado izq.', title: 'Nombre a lo alto', body: mode === 'real' ? `${n.mark} y los componentes, escritos a lo alto.` : 'Nombre ficticio a lo alto; tapa la marca real.' },
    { face: 'right', label: 'Lado der.', title: 'Lote en relieve', body: 'Este lado lleva el lote y las fechas de la muestra, en relieve.' },
  ];
}

/** Tablas de la ficha en PDF (scripts/fichas/build_fichas.py), con el texto de la caja */
export function vitCards() {
  const I = VITYBELL_INFO;
  return [
    {
      id: 'composicion',
      title: 'Información nutricional',
      rowsHead: ['Por porción (1 cápsula blanda)', 'Cantidad', '%VDR'] as [string, string, string],
      rows: I.nutrients.map((n) => ({ label: n.full, value: n.amount, extra: n.vdrText })),
      foot: I.vdrNote,
    },
    {
      id: 'indicacion',
      title: 'En los cantos de la caja',
      rows: [
        { label: I.claims.cabello, value: '' },
        { label: I.claims.unas, value: '' },
        { label: `Contenido: ${I.net.replace('Contenido Neto: ', '')} ${I.netDetail}`, value: '' },
      ],
      foot: 'Texto impreso en la caja.',
    },
    {
      id: 'fabricante',
      title: 'Fabricante',
      body: `${I.maker} ${I.registry} ${I.importer}`,
      foot: 'Muestra gratuita. Contiene soya (ver el listado de ingredientes en el reverso de la caja).',
    },
  ];
}
