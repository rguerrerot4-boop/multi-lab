// Textos de DEFEROL® transcritos de la caja (sin imágenes), para la app y para los scripts.
// Producto real de Procaps, mostrado con permiso del laboratorio. Es una muestra médica (prohibida su venta):
// la app no la vende ni la entrega. No agregues indicaciones ni afirmaciones que no estén impresas en la caja.
// La ortografía es la de la caja («Quito- Ecuador», «U.I.», mayúsculas de los avisos).
import type { VitrinaMode, VitrinaNames } from './coraessens-info';

export const DEFEROL_INFO = {
  id: 'def',
  // proporción medida en las fotos (ancho 1,64 : alto 1 : fondo 0,335); el tamaño en cm es aproximado
  dims: { w: 1.636, h: 1, d: 0.335 },
  sizeCm: { w: 7, h: 4.3, d: 1.45 },
  names: {
    real: {
      name: 'DEFEROL',
      mark: 'Deferol®',
      lab: 'Procaps',
      labLine: 'Procaps · vitamina D3',
      disclaimer:
        'Producto real de Procaps, mostrado con permiso del laboratorio. La información está tomada de la caja de la muestra médica y no reemplaza su inserto.',
      arTitle: 'DEFEROL · Procaps',
      arId: 'def',
    },
    ficticio: {
      name: 'SOLDEVA',
      mark: 'Soldeva',
      lab: 'Bioandes',
      labLine: 'Bioandes · laboratorio ficticio',
      disclaimer:
        'Versión con nombre y laboratorio ficticios para el prototipo académico. Se usa la misma caja fotografiada como ejemplo.',
      arTitle: 'SOLDEVA · producto ficticio',
      arId: 'def-f',
    },
  } as Record<VitrinaMode, VitrinaNames>,
  // frente de la caja
  front: {
    sample: 'MUESTRA MÉDICA PROHIBIDA SU VENTA',
    active: 'Vitamina D3 7000 U.I.',
    units: '1 Cápsula blanda de gelatina',
  },
  activeName: 'Vitamina D3',
  activeQty: '7000',
  activeUnit: 'U.I.',
  // reverso de la caja, en el orden impreso
  composition: 'Cada cápsula blanda contiene: Vitamina D3 7000 U.I.; Excipientes: c.s.',
  excipients: 'Excipientes: c.s.',
  pharmaForm: 'Cápsula blanda.',
  route: 'Oral.',
  dosage: '1 cápsula semanal.',
  /** modo de uso: el nombre cambia con el modo (real o ficticio) */
  usage: (name: string) => `${name} 7000 U.I. puede tomarse independientemente de las comidas.`,
  indications: [
    'Tratamiento de la deficiencia de Vitamina D (suero 25 (OH) D < 25 nmol/L).',
    'Prevención de la deficiencia de Vitamina D en pacientes de alto riesgo.',
    'Como complemento de la terapia específica para la osteoporosis en pacientes con deficiencia de Vitamina D o en riesgo de insuficiencia de Vitamina D.',
  ],
  contraindications:
    'Está contraindicado en todas las enfermedades asociadas con hipercalcemia, así como en pacientes con hipersensibilidad conocida a la Vitamina D3, a algunos de los excipientes de la fórmula o a otros fármacos de la misma clase, o exista evidencia de antecedentes de toxicidad a la Vitamina D3.',
  warnings: ['Ver inserto adjunto.', 'Si los síntomas persisten consulte a su médico.'],
  maxIntake: 'Consumo máximo: 2 cápsulas semanales.',
  maxPerWeek: 2,
  maker: 'Elaborado por PROCAPS S.A. Barranquilla – Colombia.',
  registryCo: 'Registro Sanitario No. INVIMA 2016 M-0017090 Colombia.',
  importer: 'Importado y Distribuido por RODDOME PHARMACEUTICAL S.A. (Quito- Ecuador).',
  registryEc: 'Registro Sanitario No. 5725-MEE-1220 Ecuador.',
  sale: 'VENTA LIBRE.',
  children: 'MANTÉNGASE FUERA DEL ALCANCE DE LOS NIÑOS.',
  storage: 'CONSÉRVESE A TEMPERATURA NO MAYOR A 30°C. EN SU ENVASE Y EMPAQUE ORIGINAL.',
  maxTemp: 30,
  logos: ['PROCAPS', 'RODDOME'], // logotipos impresos en el reverso
};

/** Partes de la caja que se pueden mirar (la caja gira hasta dejarlas de frente) */
export interface DefFace {
  face: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
  label: string;
  title: string;
  body: string;
}

export function defFaces(mode: VitrinaMode): DefFace[] {
  const I = DEFEROL_INFO;
  const n = I.names[mode];
  return [
    { face: 'front', label: 'Frente', title: n.mark, body: `${I.front.active}. ${I.front.units}. «Muestra médica prohibida su venta».` },
    { face: 'back', label: 'Reverso', title: 'Todo el texto', body: 'Composición, forma farmacéutica, vía de administración, dosificación, modo de uso, indicaciones, contraindicaciones, advertencias y fabricante.' },
    { face: 'left', label: 'Lado izq.', title: 'Nombre a lo largo', body: mode === 'real' ? `${n.mark} · ${I.front.active}, escrito a lo alto.` : 'Nombre ficticio a lo alto; tapa la marca real.' },
    { face: 'right', label: 'Lado der.', title: 'Lote en relieve', body: 'Este lado lleva el lote y la fecha de vencimiento de la muestra, en relieve.' },
    { face: 'top', label: 'Arriba', title: 'Canto superior', body: mode === 'real' ? `${n.mark} · ${I.front.active}.` : 'Nombre ficticio en el canto.' },
    { face: 'bottom', label: 'Abajo', title: 'Canto inferior', body: mode === 'real' ? `${n.mark} · ${I.front.active}.` : 'Nombre ficticio en el canto.' },
  ];
}

/** Tablas de la ficha en PDF (scripts/fichas/build_fichas.py), con el texto del reverso de la caja */
export function defCards() {
  const I = DEFEROL_INFO;
  return [
    {
      id: 'composicion',
      title: 'Composición',
      rowsHead: ['Cada cápsula blanda contiene', 'Cantidad'] as [string, string],
      rows: [
        { label: I.activeName, value: `${I.activeQty} ${I.activeUnit}` },
        { label: 'Excipientes', value: 'c.s.' },
        { label: `Forma farmacéutica: ${I.pharmaForm}`, value: '' },
        { label: `Vía de administración: ${I.route}`, value: '' },
        { label: I.maxIntake, value: '' },
      ],
      foot: 'Texto impreso en el reverso de la caja.',
    },
    {
      id: 'indicacion',
      title: 'Indicaciones',
      rows: I.indications.map((t) => ({ label: t, value: '' })),
      foot: 'Texto impreso en el reverso de la caja (las contraindicaciones están en «Avisos»).',
    },
    {
      id: 'fabricante',
      title: 'Fabricante',
      body: `${I.maker} ${I.registryCo} ${I.importer} ${I.registryEc}`,
      foot: `${I.sale} ${I.children} ${I.storage}`,
    },
  ];
}
