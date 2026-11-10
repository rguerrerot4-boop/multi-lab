// Textos de TEARSOFT® transcritos de la caja (sin imágenes), para la app y para los scripts.
// Producto real de Procaps, mostrado con permiso del laboratorio. Es una muestra médica (prohibida su venta):
// la app no la vende ni la entrega. No agregues indicaciones ni afirmaciones que no estén impresas en la caja.
// La ortografía es la de la caja («ácido fosfonico», «solución oftalmica» en la forma farmacéutica).
import type { VitrinaMode, VitrinaNames } from './coraessens-info';

export const TEARSOFT_INFO = {
  id: 'tea',
  // proporción medida en las fotos (ancho 1 : fondo 0,79 : alto 1,96); el tamaño en cm es aproximado
  dims: { w: 1, h: 1.963, d: 0.79 },
  sizeCm: { w: 2.7, h: 5.3, d: 2.2 },
  names: {
    real: {
      name: 'TEARSOFT',
      mark: 'Tearsoft®',
      lab: 'Procaps',
      labLine: 'Procaps · solución oftálmica',
      disclaimer:
        'Producto real de Procaps, mostrado con permiso del laboratorio. La información está tomada de la caja de la muestra médica y no reemplaza su inserto.',
      arTitle: 'TEARSOFT · Procaps',
      arId: 'tea',
    },
    ficticio: {
      name: 'LUBRAVIS',
      mark: 'Lubravis',
      lab: 'Bioandes',
      labLine: 'Bioandes · laboratorio ficticio',
      disclaimer:
        'Versión con nombre y laboratorio ficticios para el prototipo académico. Se usa la misma caja fotografiada como ejemplo.',
      arTitle: 'LUBRAVIS · producto ficticio',
      arId: 'tea-f',
    },
  } as Record<VitrinaMode, VitrinaNames>,
  // frente de la caja
  front: {
    sample: 'MUESTRA MÉDICA PROHIBIDA SU VENTA',
    volume: '3 mL',
    form: 'SOLUCIÓN OFTÁLMICA',
    active: 'CARBOXIMETILCELULOSA SÓDICA 5 mg/mL',
  },
  units: '1 FRASCO', // en las tapas de la caja
  // costado de la caja, en el orden impreso
  composition: 'cada mL de solución oftálmica contiene: carboximetilcelulosa sódica 5 mg.',
  activeName: 'Carboximetilcelulosa sódica',
  activeQty: '5 mg',
  excipients: [
    'cloruro de potasio',
    'ácido bórico',
    'borato de sodio decahidrato',
    'cloruro de sodio',
    'perborato de sodio tetrahidrato',
    'ácido fosfonico (DTPMPA) al 25%',
    'ácido clorhídrico',
    'agua para inyección c.s.p.',
  ],
  pharmaForm: 'solución oftalmica.',
  route: 'Colombia: conjuntival. Otros países: oftálmica.',
  dosage: '1 o 2 gotas en el ojo afectado cuantas veces al día sea necesario.',
  drops: '1 mL = 20 gotas.',
  indication:
    'alivio temporal de la irritación, picazón, ardor y molestias que se presentan en el síndrome de resequedad ocular sea éste moderado o severo, de cualquier etiología, incluyendo la irritación ocular causada por el viento y la exposición al sol.',
  contraindications: 'historia de hipersensibilidad a alguno de los componentes de la fórmula.',
  warning: 'Para evitar contaminación no toque ni ponga en contacto la punta del dispensador con la zona afectada.',
  precautions:
    'si durante la utilización se presenta dolor ocular, cambios en la agudeza visual o continúan los signos de irritación y éstos se presentan o persisten por 72 horas, descontinuar el producto y consultar con el oftalmólogo.',
  insert: 'Bolivia, Ecuador: para mayor información ver inserto adjunto.',
  logos: ['PROCAPS', 'RODDOME'], // logotipos impresos al pie del costado
};

/** Puntos sobre la caja desplegada (cara y posición dentro de ella, 0–1) */
export interface TeaSpot {
  id: string;
  face: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
  u: number;
  v: number;
  title: string;
  body: string;
}

export function teaSpots(mode: VitrinaMode): TeaSpot[] {
  const I = TEARSOFT_INFO;
  const n = I.names[mode];
  return [
    { id: 'muestra', face: 'front', u: 0.5, v: 0.24, title: 'Muestra médica', body: 'Impreso en el frente: «Muestra médica prohibida su venta».' },
    { id: 'volumen', face: 'front', u: 0.22, v: 0.5, title: I.front.volume, body: 'Solución oftálmica. En las tapas de la caja: «1 frasco».' },
    { id: 'nombre', face: 'front', u: 0.55, v: 0.86, title: n.mark, body: mode === 'real' ? `${I.front.active}.` : 'Nombre ficticio: tapa la marca real en la versión del prototipo.' },
    { id: 'braille', face: 'back', u: 0.45, v: 0.45, title: 'Braille en relieve', body: 'El reverso repite el frente y lleva una línea de braille en relieve.' },
    { id: 'composicion', face: 'left', u: 0.5, v: 0.2, title: 'Composición', body: `Cada mL contiene ${I.activeName.toLowerCase()} ${I.activeQty}, más ${I.excipients.length} excipientes.` },
    { id: 'tapa', face: 'top', u: 0.5, v: 0.5, title: I.units, body: 'Las tapas de la caja repiten el nombre, la forma farmacéutica y el principio activo.' },
  ];
}
