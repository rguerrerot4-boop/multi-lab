// Vitrina 3D: productos fotografiados en la sesión de fotos, con sus caras como textura.
//
// CORAESSENS® es un producto REAL de Nutrabiotics que se muestra con permiso del laboratorio.
// Todo el contenido está transcrito del empaque (muestra médica). No se agregan indicaciones,
// estudios ni afirmaciones que no estén impresas en la caja.
// El modo "ficticio" usa el mismo empaque con el nombre y el laboratorio alterados (KARDENSA · Bioandes).
import type { ImageSourcePropType } from 'react-native';
import type { BoxFace, BoxTextures } from '@/components/PhotoBox3D';
import { productById } from './mock';

export type VitrinaMode = 'real' | 'ficticio';

export interface InfoRow {
  label: string;
  value: string;
  extra?: string; // tercera columna (%VDR)
}

export interface VitrinaCard {
  id: string;
  title: string;
  kicker: string;
  face: BoxFace;
  tone: 'red' | 'purple';
  body?: string;
  rows?: InfoRow[];
  rowsHead?: [string, string, string?];
  foot?: string;
}

export interface VitrinaNames {
  name: string;
  mark: string; // nombre con su símbolo, como en la caja
  lab: string;
  labLine: string;
  disclaimer: string;
  arTitle: string;
  arId: string;
}

const tex = (m: VitrinaMode): BoxTextures =>
  m === 'real'
    ? {
        front: require('../../assets/coraessens/front.jpg'),
        right: require('../../assets/coraessens/right.jpg'),
        back: require('../../assets/coraessens/back.jpg'),
        left: require('../../assets/coraessens/left.jpg'),
        top: require('../../assets/coraessens/top.jpg'),
        bottom: require('../../assets/coraessens/bottom.jpg'),
      }
    : {
        front: require('../../assets/coraessens/ficticio-front.jpg'),
        right: require('../../assets/coraessens/ficticio-right.jpg'),
        back: require('../../assets/coraessens/ficticio-back.jpg'),
        left: require('../../assets/coraessens/ficticio-left.jpg'),
        top: require('../../assets/coraessens/ficticio-top.jpg'),
        bottom: require('../../assets/coraessens/ficticio-bottom.jpg'),
      };

export const CORAESSENS = {
  id: 'cor',
  textures: { real: tex('real'), ficticio: tex('ficticio') } as Record<VitrinaMode, BoxTextures>,
  thumb: require('../../assets/coraessens/front.jpg') as ImageSourcePropType,
  thumbFicticio: require('../../assets/coraessens/ficticio-front.jpg') as ImageSourcePropType,
  // proporción de la caja medida en las fotos: base cuadrada, alto 1,44 veces el ancho
  dims: { w: 1, h: 1.444, d: 1 },
  sizeCm: { w: 3.6, h: 5.2, d: 3.6 }, // aproximado (mismo tamaño del modelo de AR)
  names: {
    real: {
      name: 'CORAESSENS',
      mark: 'CORAESSENS®',
      lab: 'Nutrabiotics',
      labLine: 'Nutrabiotics · con•ciencia nutricional',
      disclaimer:
        'Producto real de Nutrabiotics, mostrado con permiso del laboratorio. La información está tomada del empaque de la muestra y no reemplaza su ficha técnica.',
      arTitle: 'CORAESSENS · muestra médica',
      arId: 'cor',
    },
    ficticio: {
      name: 'KARDENSA',
      mark: 'KARDENSA',
      lab: 'Bioandes',
      labLine: 'Bioandes · laboratorio ficticio',
      disclaimer:
        'Versión con nombre y laboratorio ficticios para el prototipo académico. Se usa el mismo empaque fotografiado como ejemplo.',
      arTitle: 'KARDENSA · producto ficticio',
      arId: 'cor-f',
    },
  } as Record<VitrinaMode, VitrinaNames>,
  formula: 'Fórmula a base de corazón bovino liofilizado, magnesio, metilcobalamina, piridoxal-5-fosfato y L-5 MTHF',
  badges: ['9 cápsulas', 'Suplemento dietario', 'Vía oral'],
  sample: 'Muestra · prohibida su venta',
  // datos clave impresos en la caja
  facts: [
    { value: '9', label: 'cápsulas por caja' },
    { value: '3', label: 'cápsulas al día' },
    { value: '5,22 g', label: 'contenido neto' },
    { value: '580,48 mg', label: 'por cápsula' },
  ],
};

export const vitrinaCards = (m: VitrinaMode): VitrinaCard[] => {
  const n = CORAESSENS.names[m];
  return [
    {
      id: 'frente',
      title: n.name,
      kicker: 'Frente',
      face: 'front',
      tone: 'red',
      body: `${CORAESSENS.formula}. 9 cápsulas. Muestra · prohibida su venta.`,
    },
    {
      id: 'modo',
      title: 'Modo de empleo',
      kicker: 'Lateral izquierdo',
      face: 'left',
      tone: 'purple',
      body: 'Vía oral: adultos mayores a 18 años tomar 1 cápsula 3 veces al día, con cada comida.',
      foot: 'Contenido neto: 5,22 g (9 cápsulas de 580,48 mg).',
    },
    {
      id: 'composicion',
      title: 'Composición',
      kicker: 'Por cápsula / ingredientes',
      face: 'left',
      tone: 'red',
      rows: [
        { label: 'Polvo liofilizado de corazón bovino', value: '275 mg' },
        { label: 'Óxido de magnesio', value: '145 mg' },
        { label: 'Piridoxal-5-fosfato', value: '25 mg' },
        { label: 'Palmitato de ascorbilo', value: '10 mg' },
        { label: 'Metilcobalamina', value: '650 mcg' },
        { label: 'L-5 metiltetrahidrofolato-calcio', value: '326 mcg' },
      ],
      foot: 'Suplemento dietario.',
    },
    {
      id: 'nutricional',
      title: 'Información nutricional',
      kicker: 'Lateral derecho',
      face: 'right',
      tone: 'purple',
      rowsHead: ['Nutriente', 'Cantidad', '%VDR'],
      rows: [
        { label: 'Energía (calorías)', value: '<1 kcal', extra: '0' },
        { label: 'Folacina', value: '900 mcg', extra: '450' },
        { label: 'Vitamina B6', value: '75 mg', extra: '3750' },
        { label: 'Vitamina B12', value: '1950 mcg', extra: '195000' },
        { label: 'Vitamina C', value: '12,75 mg', extra: '21,25' },
        { label: 'Magnesio', value: '332,55 mg', extra: '110' },
      ],
      foot: 'Tamaño de la porción diaria: 3 cápsulas · Porciones por envase: 3.',
    },
    {
      id: 'descripcion',
      title: 'Descripción',
      kicker: 'Reverso',
      face: 'back',
      tone: 'red',
      body:
        'Suplemento alimenticio en cápsulas a base de polvo liofilizado de corazón bovino, magnesio, piridoxal-5-fosfato, metilcobalamina y metiltetrahidrofolato. El magnesio promueve la absorción y retención de calcio, la vitamina B12/cobalamina es necesaria para la producción de glóbulos rojos. El folato es esencial para el crecimiento y división de las células.',
      foot: 'Texto impreso en el empaque.',
    },
    {
      id: 'advertencias',
      title: 'Advertencias',
      kicker: 'Reverso',
      face: 'back',
      tone: 'purple',
      rows: [
        { label: 'Manténgase fuera del alcance de los niños.', value: '' },
        { label: 'El producto no es adecuado para ser consumido como única fuente de alimento.', value: '' },
        { label: 'No superar la dosis recomendada.', value: '' },
        { label: 'Almacénese en un lugar fresco y seco en su envase y empaque original.', value: '' },
        { label: 'No use el producto si el sello de seguridad está roto o despegado.', value: '' },
      ],
    },
    m === 'real'
      ? {
          id: 'fabricante',
          title: 'Fabricante',
          kicker: 'Reverso',
          face: 'back',
          tone: 'red',
          body:
            'Fabricado por C.I. Laboratorios Improfarme S.A.S., Bogotá D.C., Colombia, para NUTRABIOTICS S.A.S. Importado y distribuido en Ecuador por Moléculas Biológicas Biomolec Cía. Ltda., Quito, Ecuador. Notificación sanitaria 10537-ALE-0619.',
          foot: 'Lote de la muestra fotografiada: 25-211 · Fab. oct-2025 · Exp. oct-2027.',
        }
      : {
          id: 'fabricante',
          title: 'Laboratorio',
          kicker: 'Reverso',
          face: 'back',
          tone: 'red',
          body: 'Bioandes es un laboratorio ficticio del prototipo académico Multi LAB. En esta versión se ocultaron el nombre del producto, el logotipo y los datos del fabricante.',
          foot: 'Lote de la muestra fotografiada: 25-211.',
        },
    {
      id: 'tapas',
      title: 'Tapa y base',
      kicker: 'Extremos',
      face: 'top',
      tone: 'purple',
      body: m === 'real' ? 'Logotipo de Nutrabiotics en ambos extremos de la caja.' : 'Nombre del laboratorio ficticio en ambos extremos de la caja.',
    },
  ];
};

// El producto del catálogo usa las mismas fotos (ficha, visor 3D, presentación, tarjetas)
const cor = productById(CORAESSENS.id);
if (cor) cor.photo = { textures: CORAESSENS.textures.real, dims: CORAESSENS.dims, vitrina: '/vitrina/cor' };
