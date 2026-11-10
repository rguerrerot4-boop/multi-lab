// Datos simulados para el prototipo académico Multi LAB.
// Las personas, consultorios y ubicaciones son FICTICIOS.
// Los 5 productos del catálogo son reales y se muestran con permiso de su laboratorio:
// CORAESSENS y PANCREOGEN (Nutrabiotics) y TEARSOFT, DEFEROL y VITYBELL (Procaps).
// Su texto está tomado del empaque; no se agregan indicaciones que no estén impresas.

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { BoxTextures } from '@/components/PhotoBox3D';
import type { ImageSourcePropType } from 'react-native';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type Role = 'medico' | 'visitador';

export type RequestStatus =
  | 'Pendiente'
  | 'Recibida'
  | 'En revisión'
  | 'En proceso'
  | 'Atendida'
  | 'Cancelada';

export const REQUEST_FLOW: RequestStatus[] = [
  'Pendiente',
  'Recibida',
  'En revisión',
  'En proceso',
  'Atendida',
];

export type RequestType = 'Información técnica' | 'Material de apoyo' | 'Muestra original' | 'Agendar visita';

// Nivel de necesidad de una solicitud
export type RequestUrgency = 'Urgente' | 'Esta semana' | 'Sin prisa';
export const REQUEST_URGENCY: { value: RequestUrgency; desc: string; icon: IconName }[] = [
  { value: 'Urgente', desc: 'Lo necesito hoy o mañana', icon: 'flash-outline' },
  { value: 'Esta semana', desc: 'En los próximos días', icon: 'calendar-outline' },
  { value: 'Sin prisa', desc: 'Cuando el visitador pueda', icon: 'time-outline' },
];

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: Role;
  title: string;
  org: string;
  email: string;
  phone: string;
  city: string;
}

export interface Slide {
  title: string;
  body: string;
  icon: IconName;
}

export interface Hotspot {
  face: 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom';
  u: number; // posición horizontal en la cara (0-1)
  v: number; // posición vertical en la cara (0-1)
  title: string;
  text: string;
}

export interface Product {
  id: string;
  name: string;
  lab: string;
  category: string;
  form: string; // presentación
  component: string; // componente principal (ilustrativo)
  concentration: string;
  tagline: string;
  description: string;
  uses: string[];
  howTo: string[];
  precautions: string[];
  docs: string[];
  slides: Slide[];
  icon: IconName;
  hue: string; // color de la composición visual
  isNew?: boolean;
  hotspots?: Hotspot[];
  keywords?: string[]; // palabras con las que el médico puede encontrarlo (descriptivas, no indicaciones)
  areas: Area[]; // especialidades a las que el visitador lleva la información (demostración)
  /** producto real mostrado con permiso del laboratorio (texto tomado del empaque) */
  real?: { note: string };
  /** caja 3D con las fotos del empaque (vitrina 3D) */
  photo?: { textures: BoxTextures; dims: { w: number; h: number; d: number }; vitrina: string; /** fondo de su miniatura (colores del empaque); si no hay, los de CORAESSENS */ bg?: [string, string] };
  /** frasco fotografiado en 360° (cuadros renderizados del modelo 3D), con su propio catálogo */
  bottle?: { frames: ImageSourcePropType[]; framesFicticio: ImageSourcePropType[]; thumb: ImageSourcePropType; thumbFicticio: ImageSourcePropType; /** modelo .glb animado (la web lo dibuja en 3D real) */ model?: string; modelFicticio?: string };
  arTitle?: string; // título en el visor AR del teléfono
  /** cifras destacadas de la ficha (si no hay, se arman con la presentación, el componente y la concentración) */
  specs?: { value: string; label: string; note: string }[];
  /** notas de la sección de componentes (manchas de tinta en la ficha) */
  notes?: { title: string; text: string }[];
  sizeCm?: { w: number; h: number; d: number }; // tamaño del modelo AR
}

/** "Laboratorio (ficticio)" o el nombre real si el producto es real */
export const labLabel = (p: Pick<Product, 'lab' | 'real'>) => (p.real ? p.lab : `${p.lab} (ficticio)`);
/** Aviso corto para el producto */
export const productNote = (p: Pick<Product, 'real'>) => (p.real ? 'Producto real · con permiso del laboratorio' : 'Producto ficticio');

export type Area = 'Dermatología' | 'Oftalmología' | 'Medicina general';

// ---------- Laboratorios (reales, con permiso) ----------
export interface Lab {
  id: string;
  name: string; // nombre corto, igual a Product.lab
  full: string;
  real?: boolean; // laboratorio real (con permiso), no ficticio
  repId: string; // visitador asignado en la demo
  tagline: string;
  hue: string;
}
export const labs: Lab[] = [
  // laboratorios reales: sus productos se muestran con permiso (en la demo los atiende el visitador Juan Carlos Mieles)
  { id: 'nutrabiotics', name: 'Nutrabiotics', full: 'Nutrabiotics', repId: 'v1', tagline: 'Suplementos · producto real con permiso', hue: '#C9262F', real: true }, // rojo del empaque (packColors.coraessens.red)
  { id: 'procaps', name: 'Procaps', full: 'Procaps', repId: 'v1', tagline: 'Oftalmología, vitamina D3 y suplementos · productos reales con permiso', hue: '#32316C', real: true }, // azul de la caja de TEARSOFT (packColors.tearsoft.navy)
];
export const labByName = (name: string) => labs.find((l) => l.name === name);
export const labOfRep = (repId: string) => labs.find((l) => l.repId === repId);
/** Laboratorios que atiende un visitador */
export const repLabNames = (repId: string) => labs.filter((l) => l.repId === repId).map((l) => l.name);
/** Productos de los laboratorios que atiende un visitador */
export const repProducts = (repId: string) => products.filter((p) => labs.some((l) => l.repId === repId && l.name === p.lab));

/** Área del médico según su especialidad */
export const areaOf = (title: string): Area =>
  /oftalm/i.test(title) ? 'Oftalmología' : /dermat/i.test(title) ? 'Dermatología' : 'Medicina general';

// Puntos del visor 3D de CORAESSENS, con el texto impreso en cada cara
const realSpots: Hotspot[] = [
  { face: 'front', u: 0.9, v: 0.2, title: 'CORAESSENS®', text: 'Fórmula a base de corazón bovino liofilizado, magnesio, metilcobalamina, piridoxal-5-fosfato y L-5 MTHF. 9 cápsulas.' },
  { face: 'front', u: 0.5, v: 0.93, title: 'Muestra médica', text: 'Muestra · prohibida su venta.' },
  { face: 'left', u: 0.5, v: 0.1, title: 'Modo de empleo', text: 'Vía oral: adultos mayores a 18 años tomar 1 cápsula 3 veces al día, con cada comida.' },
  { face: 'left', u: 0.5, v: 0.45, title: 'Composición por cápsula', text: 'Corazón bovino liofilizado 275 mg · óxido de magnesio 145 mg · piridoxal-5-fosfato 25 mg · palmitato de ascorbilo 10 mg · metilcobalamina 650 mcg · L-5 metiltetrahidrofolato-calcio 326 mcg.' },
  { face: 'right', u: 0.5, v: 0.4, title: 'Información nutricional', text: 'Porción diaria: 3 cápsulas. Folacina 900 mcg · vitamina B6 75 mg · vitamina B12 1950 mcg · vitamina C 12,75 mg · magnesio 332,55 mg.' },
  { face: 'back', u: 0.5, v: 0.25, title: 'Advertencias', text: 'Manténgase fuera del alcance de los niños. No superar la dosis recomendada. No use el producto si el sello de seguridad está roto o despegado.' },
  { face: 'back', u: 0.4, v: 0.82, title: 'Lote de la muestra', text: 'LOT 25-211 · FAB oct-2025 · EXP oct-2027.' },
];

// puntos de la caja de TEARSOFT (texto tomado de la caja)
const teaSpots: Hotspot[] = [
  { face: 'front', u: 0.5, v: 0.24, title: 'Muestra médica', text: 'Muestra médica prohibida su venta. 3 mL · solución oftálmica.' },
  { face: 'front', u: 0.55, v: 0.88, title: 'TEARSOFT®', text: 'Procaps. Carboximetilcelulosa sódica 5 mg/mL.' },
  { face: 'left', u: 0.5, v: 0.12, title: 'Composición', text: 'Cada mL de solución oftálmica contiene: carboximetilcelulosa sódica 5 mg.' },
  { face: 'left', u: 0.5, v: 0.3, title: 'Dosificación', text: '1 o 2 gotas en el ojo afectado cuantas veces al día sea necesario. 1 mL = 20 gotas.' },
  { face: 'left', u: 0.5, v: 0.62, title: 'Advertencias', text: 'Para evitar contaminación no toque ni ponga en contacto la punta del dispensador con la zona afectada.' },
];

// puntos de la caja de DEFEROL (texto tomado de la caja)
const defSpots: Hotspot[] = [
  { face: 'front', u: 0.26, v: 0.17, title: 'Muestra médica', text: 'Muestra médica prohibida su venta.' },
  { face: 'front', u: 0.68, v: 0.6, title: 'DEFEROL®', text: 'Vitamina D3 7000 U.I. · 1 cápsula blanda de gelatina.' },
  { face: 'back', u: 0.25, v: 0.12, title: 'Composición', text: 'Cada cápsula blanda contiene: Vitamina D3 7000 U.I.; Excipientes: c.s.' },
  { face: 'back', u: 0.25, v: 0.24, title: 'Dosificación', text: '1 cápsula semanal. Consumo máximo: 2 cápsulas semanales.' },
  { face: 'back', u: 0.5, v: 0.33, title: 'Indicaciones', text: 'Tratamiento de la deficiencia de Vitamina D (suero 25 (OH) D < 25 nmol/L). Prevención de la deficiencia de Vitamina D en pacientes de alto riesgo.' },
  { face: 'back', u: 0.25, v: 0.9, title: 'Conservación', text: 'Consérvese a temperatura no mayor a 30 °C en su envase y empaque original.' },
];

// puntos de la caja de VITYBELL (texto tomado de la caja)
const vitSpots: Hotspot[] = [
  { face: 'front', u: 0.47, v: 0.25, title: 'VITYBELL®', text: 'Suplemento alimenticio en cápsula blanda a base de: Biotina + Ácido Pantoténico + Nicotinamida + Zinc + Cobre + Selenio + Riboflavina + Piridoxina.' },
  { face: 'front', u: 0.2, v: 0.86, title: 'Contenido neto', text: 'Contenido Neto: 4.050 g (5 Cápsulas blandas x 0.810 g/Cápsula). Muestra gratuita.' },
  { face: 'back', u: 0.5, v: 0.15, title: 'Información nutricional', text: 'Porción: 1 Cápsula blanda (0.810 g). Biotina 900 µg (300% VDR) · Zinc 20 mg (133.33% VDR) · Selenio 200 µg (285.7% VDR).' },
  { face: 'back', u: 0.4, v: 0.72, title: 'Modo de uso', text: 'Vía oral. Tomar una (1) cápsula al día. Consumo máximo diario: 1 cápsula en 24 horas. Adultos mayores de 18 años.' },
  { face: 'top', u: 0.55, v: 0.7, title: 'Cabello y uñas', text: 'El Zinc y la Biotina contribuyen al mantenimiento del cabello en condiciones normales. El Zinc contribuye al mantenimiento de las uñas en condiciones normales.' },
];

export interface Visit {
  id: string;
  doctorId: string;
  dayOffset: number; // días desde hoy
  time: string;
  place: string;
  address: string;
  status: 'Programada' | 'En curso' | 'Realizada' | 'Reprogramada';
  productIds: string[];
  notes: string;
  lat: number; // coordenadas aproximadas de la zona (dirección ficticia)
  lon: number;
  report?: VisitReport;
}

// ---------- Registro de visita en curso ----------
// El visitador registra el material de demostración que deja en el consultorio.
// No es una venta ni una dispensación: solo un acuse de recibo con firma.
export type DeliveryKind = 'muestra' | 'impreso' | 'digital';

export const DELIVERY_KINDS: { kind: DeliveryKind; label: string; short: string; one: string; many: string; icon: IconName }[] = [
  { kind: 'muestra', label: 'Muestras de demostración', short: 'Muestras', one: 'muestra', many: 'muestras', icon: 'cube-outline' },
  { kind: 'impreso', label: 'Material impreso', short: 'Impresos', one: 'impreso', many: 'impresos', icon: 'document-text-outline' },
  { kind: 'digital', label: 'Ficha digital enviada', short: 'Digital', one: 'ficha digital', many: 'fichas digitales', icon: 'phone-portrait-outline' },
];

export type Interest = 'Alto' | 'Medio' | 'Bajo';
export const NEXT_STEPS = ['Enviar información técnica', 'Agendar seguimiento', 'Dejar más material', 'Sin acciones'] as const;
export type NextStep = (typeof NEXT_STEPS)[number];

export interface Signature {
  w: number;
  h: number;
  paths: string[]; // trazos SVG
  name: string;
  at: number;
}

export interface VisitReport {
  startedAt: number;
  endedAt?: number;
  presented: string[]; // productos presentados
  deliveries: Record<string, Partial<Record<DeliveryKind, number>>>; // productId → cantidades
  interest?: Interest;
  nextSteps: NextStep[];
  followUpDays?: number;
  notes: string;
  signature?: Signature;
}

export const emptyReport = (productIds: string[]): VisitReport => ({
  startedAt: Date.now(),
  presented: [],
  deliveries: Object.fromEntries(productIds.map((id) => [id, {}])),
  nextSteps: [],
  notes: '',
});

export const deliveredTotal = (r?: VisitReport, kind?: DeliveryKind) =>
  r
    ? Object.values(r.deliveries).reduce(
        (s, d) => s + (kind ? d[kind] ?? 0 : (d.muestra ?? 0) + (d.impreso ?? 0) + (d.digital ?? 0)),
        0,
      )
    : 0;

// Datos de contexto de cada profesional (ficticios) para la vista de visita
export const DOCTOR_INFO: Record<string, { hours: string; prefers: string; patients: string; tip: string }> = {
  m1: { hours: 'Lun a vie · 14:00 a 19:00', prefers: 'Visitas cortas, máximo 10 min', patients: 'Consulta de cabello, uñas y piel', tip: 'Le interesa el material de VITYBELL para la sala de espera.' },
  m2: { hours: 'Lun a sáb · 08:00 a 13:00', prefers: 'Material visual y digital', patients: 'Consulta de oftalmología', tip: 'Prefiere recibir la ficha de TEARSOFT por chat antes de la visita.' },
  m3: { hours: 'Mar y jue · 09:00 a 16:00', prefers: 'Visitas con cita previa', patients: 'Medicina familiar', tip: 'Pidió reprogramar visitas con un día de aviso. Le interesan los suplementos.' },
  m4: { hours: 'Lun a vie · 15:00 a 20:00', prefers: 'Información técnica detallada', patients: 'Dermatología clínica', tip: 'Tiene una solicitud de información técnica de VITYBELL abierta.' },
};

// Kit de material de demostración del visitador (cantidades iniciales ficticias)
export const INITIAL_KIT: Record<string, Record<DeliveryKind, number>> = {
  cor: { muestra: 10, impreso: 15, digital: 99 },
  pan: { muestra: 6, impreso: 15, digital: 99 },
  tea: { muestra: 14, impreso: 25, digital: 99 },
  def: { muestra: 16, impreso: 30, digital: 99 },
  vit: { muestra: 12, impreso: 25, digital: 99 },
};

export interface RequestItem {
  id: string;
  code: string;
  productId: string;
  type: RequestType;
  urgency?: RequestUrgency;
  notes: string;
  doctorId: string;
  repId: string;
  status: RequestStatus;
  history: { status: RequestStatus; at: string }[];
  createdAt: string;
}

export interface Message {
  id: string;
  from: string; // id de persona
  text: string;
  at: string;
  productId?: string;
}

export interface Chat {
  id: string;
  members: [string, string];
  messages: Message[];
  unreadFor: Record<string, number>;
}

export interface Notice {
  id: string;
  forRole: Role | 'all';
  kind: 'mensaje' | 'solicitud' | 'visita' | 'producto';
  title: string;
  body: string;
  at: string;
  read: boolean;
  href: string;
}

// ---------- Personas ----------
export const people: Person[] = [
  {
    id: 'm1',
    name: 'Dra. Pamela Toscano',
    initials: 'PT',
    role: 'medico',
    title: 'Dermatóloga',
    org: 'Consultorio Dermatológico Toscano',
    email: 'pamela.toscano@demo-multilab.ec',
    phone: '+593 99 000 0101',
    city: 'Guayaquil',
  },
  {
    id: 'v1',
    name: 'Juan Carlos Mieles',
    initials: 'JM',
    role: 'visitador',
    title: 'Visitador médico · Nutrabiotics y Procaps',
    org: 'Nutrabiotics · Procaps',
    email: 'juancarlos.mieles@demo-multilab.ec',
    phone: '+593 98 000 0202',
    city: 'Guayaquil',
  },
  {
    id: 'm2',
    name: 'Dr. Andrés Villacís',
    initials: 'AV',
    role: 'medico',
    title: 'Oftalmólogo',
    org: 'Centro Oftalmológico Los Ceibos (ficticio)',
    email: 'andres.villacis@demo-multilab.ec',
    phone: '+593 99 000 0303',
    city: 'Guayaquil',
  },
  {
    id: 'm3',
    name: 'Dra. Carla Benítez',
    initials: 'CB',
    role: 'medico',
    title: 'Medicina general',
    org: 'Consultorio Benítez (ficticio)',
    email: 'carla.benitez@demo-multilab.ec',
    phone: '+593 99 000 0404',
    city: 'Milagro',
  },
  {
    id: 'm4',
    name: 'Dr. Luis Ortega',
    initials: 'LO',
    role: 'medico',
    title: 'Dermatólogo',
    org: 'Clínica Dermasur (ficticio)',
    email: 'luis.ortega@demo-multilab.ec',
    phone: '+593 99 000 0505',
    city: 'Durán',
  },
];

export const DEMO_USER: Record<Role, string> = { medico: 'm1', visitador: 'v1' };

// ---------- Productos (reales, con permiso del laboratorio) ----------
export const categories = ['Todos', 'Suplementos', 'Vitaminas', 'Oftalmología'];

export const products: Product[] = [
  {
    // PRODUCTO REAL (con permiso de Nutrabiotics). Todo el texto está tomado del empaque de la muestra.
    id: 'cor',
    name: 'CORAESSENS',
    lab: 'Nutrabiotics',
    category: 'Suplementos',
    form: 'Cápsulas · caja de 9 (muestra)',
    component: 'Polvo liofilizado de corazón bovino',
    concentration: '275 mg por cápsula',
    tagline: 'Fórmula a base de corazón bovino liofilizado, magnesio, metilcobalamina, piridoxal-5-fosfato y L-5 MTHF',
    description:
      'Suplemento alimenticio en cápsulas a base de polvo liofilizado de corazón bovino, magnesio, piridoxal-5-fosfato, metilcobalamina y metiltetrahidrofolato. El magnesio promueve la absorción y retención de calcio, la vitamina B12/cobalamina es necesaria para la producción de glóbulos rojos. El folato es esencial para el crecimiento y división de las células.',
    uses: ['Suplemento dietario', 'Vía oral · adultos mayores a 18 años'],
    howTo: ['Vía oral', 'Adultos mayores a 18 años: 1 cápsula 3 veces al día', 'Tomar con cada comida'],
    precautions: [
      'Manténgase fuera del alcance de los niños',
      'No es adecuado para ser consumido como única fuente de alimento',
      'No superar la dosis recomendada',
      'Almacénese en un lugar fresco y seco en su envase y empaque original',
      'No use el producto si el sello de seguridad está roto o despegado',
    ],
    docs: ['Fotos del empaque (6 caras).png'],
    slides: [
      { title: 'Fórmula', body: 'Corazón bovino liofilizado 275 mg, óxido de magnesio 145 mg, piridoxal-5-fosfato 25 mg, palmitato de ascorbilo 10 mg, metilcobalamina 650 mcg y L-5 metiltetrahidrofolato-calcio 326 mcg por cápsula.', icon: 'flask-outline' },
      { title: 'Modo de empleo', body: 'Vía oral: adultos mayores a 18 años tomar 1 cápsula 3 veces al día, con cada comida.', icon: 'time-outline' },
      { title: 'Presentación', body: 'Caja de 9 cápsulas de 580,48 mg. Contenido neto 5,22 g. Muestra · prohibida su venta.', icon: 'cube-outline' },
    ],
    icon: 'nutrition-outline',
    hue: '#C9262F', // rojo del empaque (packColors.coraessens.red)
    isNew: true,
    keywords: ['coraessens', 'nutrabiotics', 'suplemento', 'suplemento dietario', 'suplemento alimenticio', 'cápsulas', 'corazón', 'corazón bovino', 'liofilizado', 'magnesio', 'calcio', 'vitamina b12', 'b12', 'cobalamina', 'metilcobalamina', 'glóbulos rojos', 'vitamina b6', 'b6', 'piridoxal', 'folato', 'folacina', 'metilfolato', 'l-5 mthf', 'vitamina c', 'oral', 'adultos', 'muestra médica'],
    areas: ['Medicina general'], // especialidad a la que el visitador lleva la información (demostración; el empaque no la dirige a ninguna)
    real: { note: 'Producto real de Nutrabiotics, mostrado con permiso del laboratorio. Información tomada del empaque de la muestra.' },
    specs: [
      { value: '9', label: 'Cápsulas por caja', note: 'Muestra · prohibida su venta' },
      { value: '3', label: 'Cápsulas al día', note: '1 cápsula con cada comida' },
      { value: '275 mg', label: 'Corazón bovino liofilizado', note: 'Por cápsula de 580,48 mg' },
    ],
    notes: [
      { title: 'Corazón bovino', text: 'Polvo liofilizado, 275 mg por cápsula.' },
      { title: 'Magnesio', text: 'Óxido de magnesio 145 mg. Promueve la absorción y retención de calcio.' },
      { title: 'Vitamina B12', text: 'Metilcobalamina 650 mcg. Necesaria para la producción de glóbulos rojos.' },
      { title: 'Folato', text: 'L-5 MTHF 326 mcg. Esencial para el crecimiento y división de las células.' },
      { title: 'Vitamina B6', text: 'Piridoxal-5-fosfato 25 mg.' },
    ],
    // las fotos del empaque (photo) se agregan en src/data/vitrina.ts, que se carga en src/app/_layout.tsx
    arTitle: 'CORAESSENS · muestra médica',
    sizeCm: { w: 3.6, h: 5.2, d: 3.6 },
  },
  {
    // PRODUCTO REAL (con permiso de Nutrabiotics). Todo el texto está tomado del frasco (src/data/pancreogen-info.ts).
    id: 'pan',
    name: 'PANCREOGEN',
    lab: 'Nutrabiotics',
    category: 'Suplementos',
    form: 'Cápsulas · frasco de 90',
    component: 'Polvo liofilizado de páncreas bovino',
    concentration: '537,56 mg por cápsula',
    tagline: 'Fórmula a base de menudo (páncreas) bovino liofilizado, vitaminas y minerales esenciales',
    description:
      'Suplemento alimenticio en cápsulas a base de polvo liofilizado de páncreas bovino, canela, vitaminas y minerales esenciales. La vitamina D ayuda al organismo a utilizar el calcio y el fósforo.',
    uses: ['Suplemento dietario', 'Vía oral · adultos mayores de 18 años'],
    howTo: ['Vía oral', 'Adultos mayores de 18 años: 1 cápsula 3 veces al día'],
    precautions: [
      'Manténgase fuera del alcance de los niños',
      'No es adecuado para ser consumido como única fuente de alimento',
      'No superar la dosis recomendada',
      'Almacénese en un lugar fresco y seco en su envase y empaque original',
      'No use el producto si el sello de seguridad está roto o despegado',
    ],
    docs: ['Fotos del frasco (360°).png'],
    slides: [
      { title: 'Fórmula', body: 'Polvo liofilizado de páncreas bovino, canela, vitaminas (C, D3 y biotina) y minerales (manganeso, zinc, cromo y vanadio).', icon: 'flask-outline' },
      { title: 'Modo de empleo', body: 'Vía oral: adultos mayores de 18 años tomar 1 cápsula 3 veces al día.', icon: 'time-outline' },
      { title: 'Presentación', body: 'Frasco de 90 cápsulas de 537,56 mg. Contenido neto 48,3 g. Porción diaria: 3 cápsulas; 30 porciones por envase.', icon: 'cube-outline' },
    ],
    icon: 'nutrition-outline',
    hue: '#1F6B6E', // teal de la etiqueta (packColors.pancreogen.teal)
    isNew: true,
    keywords: ['pancreogen', 'nutrabiotics', 'suplemento', 'suplemento dietario', 'suplemento alimenticio', 'cápsulas', 'frasco', 'páncreas', 'páncreas bovino', 'menudo', 'liofilizado', 'canela', 'vitaminas', 'minerales', 'vitamina d', 'vitamina d3', 'calcio', 'fósforo', 'vitamina c', 'biotina', 'zinc', 'cromo', 'manganeso', 'vanadio', 'oral', 'adultos'],
    areas: ['Medicina general'], // especialidad a la que el visitador lleva la información (demostración; el frasco no lo dirige a ninguna)
    real: { note: 'Producto real de Nutrabiotics, mostrado con permiso del laboratorio. Información tomada del frasco.' },
    specs: [
      { value: '90', label: 'Cápsulas por frasco', note: 'Suplemento dietario' },
      { value: '3', label: 'Cápsulas al día', note: '1 cápsula 3 veces al día' },
      { value: '48,3 g', label: 'Contenido neto', note: '90 cápsulas de 537,56 mg' },
    ],
    notes: [
      { title: 'Páncreas bovino', text: 'Polvo liofilizado de páncreas bovino.' },
      { title: 'Vitamina D', text: '48,74 mcg por porción diaria (975 %VDR). Ayuda al organismo a utilizar el calcio y el fósforo.' },
      { title: 'Cromo', text: '585,3 mcg por porción diaria (488 %VDR).' },
      { title: 'Manganeso', text: '8,25 mg por porción diaria (413 %VDR).' },
      { title: 'Zinc', text: '15,39 mg por porción diaria (103 %VDR).' },
    ],
    // el frasco 360° (bottle) se agrega en src/data/pancreogen.ts, que se carga en src/app/_layout.tsx
    arTitle: 'PANCREOGEN · Nutrabiotics',
    sizeCm: { w: 4, h: 12.4, d: 4 },
  },
  {
    // PRODUCTO REAL (con permiso de Procaps). Todo el texto está tomado de la caja (src/data/tearsoft-info.ts).
    id: 'tea',
    name: 'TEARSOFT',
    lab: 'Procaps',
    category: 'Oftalmología',
    form: 'Solución oftálmica · frasco de 3 mL',
    component: 'Carboximetilcelulosa sódica',
    concentration: '5 mg/mL',
    tagline: 'Solución oftálmica · carboximetilcelulosa sódica 5 mg/mL',
    description:
      'Solución oftálmica: cada mL contiene carboximetilcelulosa sódica 5 mg. Muestra médica de 3 mL (1 frasco), prohibida su venta.',
    uses: [
      'Alivio temporal de la irritación, picazón, ardor y molestias que se presentan en el síndrome de resequedad ocular sea éste moderado o severo, de cualquier etiología, incluyendo la irritación ocular causada por el viento y la exposición al sol',
    ],
    howTo: ['1 o 2 gotas en el ojo afectado cuantas veces al día sea necesario', '1 mL = 20 gotas', 'Vía de administración: Colombia: conjuntival. Otros países: oftálmica'],
    precautions: [
      'Contraindicaciones y advertencias: historia de hipersensibilidad a alguno de los componentes de la fórmula',
      'Para evitar contaminación no toque ni ponga en contacto la punta del dispensador con la zona afectada',
      'Si durante la utilización se presenta dolor ocular, cambios en la agudeza visual o continúan los signos de irritación y éstos se presentan o persisten por 72 horas, descontinuar el producto y consultar con el oftalmólogo',
      'Bolivia, Ecuador: para mayor información ver inserto adjunto',
    ],
    docs: ['Fotos de la caja (6 caras).png'],
    slides: [
      { title: 'Composición', body: 'Cada mL de solución oftálmica contiene carboximetilcelulosa sódica 5 mg.', icon: 'flask-outline' },
      { title: 'Dosificación', body: '1 o 2 gotas en el ojo afectado cuantas veces al día sea necesario. 1 mL = 20 gotas.', icon: 'water-outline' },
      { title: 'Presentación', body: 'Muestra médica: 1 frasco de 3 mL de solución oftálmica. Prohibida su venta.', icon: 'cube-outline' },
    ],
    icon: 'eye-outline',
    hue: '#32316C', // azul del texto de la caja (packColors.tearsoft.navy)
    isNew: true,
    keywords: ['tearsoft', 'procaps', 'solución oftálmica', 'gotas', 'gotas para los ojos', 'colirio', 'ojo', 'ojos', 'ojo seco', 'oftálmica', 'oftalmología', 'carboximetilcelulosa', 'carboximetilcelulosa sódica', 'resequedad ocular', 'irritación ocular', 'picazón', 'ardor', 'viento', 'sol', 'lágrima', 'frasco', 'muestra médica'],
    areas: ['Oftalmología', 'Medicina general'], // especialidades a las que el visitador lleva la información (demostración)
    real: { note: 'Producto real de Procaps, mostrado con permiso del laboratorio. Información tomada de la caja.' },
    specs: [
      { value: '3 mL', label: 'Solución oftálmica', note: '1 frasco · muestra médica' },
      { value: '5 mg', label: 'Por mL', note: 'Carboximetilcelulosa sódica' },
      { value: '20', label: 'Gotas por mL', note: '1 mL = 20 gotas' },
    ],
    notes: [
      { title: 'Carboximetilcelulosa sódica', text: '5 mg en cada mL de solución oftálmica.' },
      { title: 'Dosificación', text: '1 o 2 gotas en el ojo afectado cuantas veces al día sea necesario.' },
    ],
    // la caja con sus fotos (photo) se agrega en src/data/tearsoft.ts, que se carga en src/app/_layout.tsx
    arTitle: 'TEARSOFT · Procaps',
    sizeCm: { w: 2.7, h: 5.3, d: 2.2 },
  },
  {
    // PRODUCTO REAL (con permiso de Procaps). Todo el texto está tomado de la caja (src/data/deferol-info.ts).
    id: 'def',
    name: 'DEFEROL',
    lab: 'Procaps',
    category: 'Vitaminas',
    form: 'Cápsula blanda · 1 cápsula',
    component: 'Vitamina D3',
    concentration: '7000 U.I. por cápsula',
    tagline: 'Vitamina D3 7000 U.I. · cápsula blanda de gelatina',
    description: 'Cada cápsula blanda contiene: Vitamina D3 7000 U.I.; Excipientes: c.s. Muestra médica de 1 cápsula blanda de gelatina, prohibida su venta.',
    uses: [
      'Tratamiento de la deficiencia de Vitamina D (suero 25 (OH) D < 25 nmol/L)',
      'Prevención de la deficiencia de Vitamina D en pacientes de alto riesgo',
      'Como complemento de la terapia específica para la osteoporosis en pacientes con deficiencia de Vitamina D o en riesgo de insuficiencia de Vitamina D',
    ],
    howTo: ['Vía de administración: oral', 'Dosificación: 1 cápsula semanal', 'Puede tomarse independientemente de las comidas', 'Consumo máximo: 2 cápsulas semanales'],
    precautions: [
      'Contraindicaciones: está contraindicado en todas las enfermedades asociadas con hipercalcemia, así como en pacientes con hipersensibilidad conocida a la Vitamina D3, a algunos de los excipientes de la fórmula o a otros fármacos de la misma clase, o exista evidencia de antecedentes de toxicidad a la Vitamina D3',
      'Advertencias y precauciones: ver inserto adjunto. Si los síntomas persisten consulte a su médico',
      'Manténgase fuera del alcance de los niños',
      'Consérvese a temperatura no mayor a 30 °C en su envase y empaque original',
    ],
    docs: ['Fotos de la caja (6 caras).png'],
    slides: [
      { title: 'Composición', body: 'Cada cápsula blanda contiene: Vitamina D3 7000 U.I.; Excipientes: c.s.', icon: 'flask-outline' },
      { title: 'Dosificación', body: '1 cápsula semanal, vía oral. Puede tomarse independientemente de las comidas. Consumo máximo: 2 cápsulas semanales.', icon: 'calendar-outline' },
      { title: 'Presentación', body: 'Muestra médica: 1 cápsula blanda de gelatina. Prohibida su venta.', icon: 'cube-outline' },
    ],
    icon: 'sunny-outline',
    hue: '#0E6A66', // turquesa oscuro de la caja (packColors.deferol.deep)
    isNew: true,
    keywords: ['deferol', 'procaps', 'vitamina', 'vitaminas', 'vitamina d', 'vitamina d3', 'colecalciferol', '7000', '7000 u.i.', 'cápsula', 'cápsula blanda', 'gelatina', 'deficiencia de vitamina d', 'prevención', 'osteoporosis', 'semanal', 'una vez por semana', 'oral', 'muestra médica'],
    areas: ['Medicina general'], // especialidad a la que el visitador lleva la información (demostración; la caja no lo dirige a ninguna)
    real: { note: 'Producto real de Procaps, mostrado con permiso del laboratorio. Información tomada de la caja.' },
    specs: [
      { value: '7000', label: 'U.I. por cápsula', note: 'Vitamina D3' },
      { value: '1', label: 'Cápsula semanal', note: 'Vía oral' },
      { value: '2', label: 'Consumo máximo', note: 'Cápsulas semanales' },
    ],
    notes: [
      { title: 'Vitamina D3', text: '7000 U.I. en cada cápsula blanda.' },
      { title: 'Dosificación', text: '1 cápsula semanal. Puede tomarse independientemente de las comidas.' },
    ],
    // la caja con sus fotos (photo) se agrega en src/data/deferol.ts, que se carga en src/app/_layout.tsx
    arTitle: 'DEFEROL · Procaps',
    sizeCm: { w: 7, h: 4.3, d: 1.45 },
  },
  {
    // PRODUCTO REAL (con permiso de Procaps). Todo el texto está tomado de la caja (src/data/vitybell-info.ts).
    id: 'vit',
    name: 'VITYBELL',
    lab: 'Procaps',
    category: 'Suplementos',
    form: 'Cápsula blanda · 5 cápsulas',
    component: 'Biotina, ácido pantoténico, nicotinamida, zinc, cobre, selenio, riboflavina y piridoxina',
    concentration: '0.810 g por cápsula',
    tagline: 'Suplemento alimenticio en cápsula blanda a base de biotina, zinc, selenio y vitaminas del complejo B',
    description:
      'Suplemento alimenticio en cápsula blanda a base de: Biotina + Ácido Pantoténico + Nicotinamida + Zinc + Cobre + Selenio + Riboflavina + Piridoxina. Contenido Neto: 4.050 g (5 Cápsulas blandas x 0.810 g/Cápsula). Muestra gratuita.',
    uses: [
      'El Zinc y la Biotina contribuyen al mantenimiento del cabello en condiciones normales',
      'El Zinc contribuye al mantenimiento de las uñas en condiciones normales',
    ],
    howTo: ['Vía de administración: oral', 'Tomar una (1) cápsula al día', 'Consumo máximo diario: 1 cápsula en 24 horas', 'Población: adultos mayores de 18 años'],
    precautions: ['Advertencia: puede causar hipersensibilidad a sus componentes', 'Contiene soya', 'Consumo máximo diario: 1 cápsula en 24 horas'],
    docs: ['Fotos de la caja (6 caras).png'],
    slides: [
      { title: 'Componentes', body: 'Biotina + Ácido Pantoténico + Nicotinamida + Zinc + Cobre + Selenio + Riboflavina + Piridoxina, en cápsula blanda.', icon: 'flask-outline' },
      { title: 'Cabello y uñas', body: 'El Zinc y la Biotina contribuyen al mantenimiento del cabello en condiciones normales. El Zinc contribuye al mantenimiento de las uñas en condiciones normales.', icon: 'sparkles-outline' },
      { title: 'Modo de uso', body: 'Vía oral. Tomar una (1) cápsula al día. Consumo máximo diario: 1 cápsula en 24 horas. Adultos mayores de 18 años.', icon: 'time-outline' },
    ],
    icon: 'flower-outline',
    hue: '#C2223F', // rojo del logotipo (packColors.vitybell.rose)
    isNew: true,
    keywords: ['vitybell', 'procaps', 'suplemento', 'suplemento alimenticio', 'cabello', 'pelo', 'uñas', 'cabello y uñas', 'biotina', 'zinc', 'selenio', 'cobre', 'minerales', 'vitaminas', 'complejo b', 'nicotinamida', 'riboflavina', 'piridoxina', 'ácido pantoténico', 'cápsula blanda', 'una al día', 'muestra gratuita', 'adultos'],
    areas: ['Dermatología', 'Medicina general'], // especialidades a las que el visitador lleva la información (demostración)
    real: { note: 'Producto real de Procaps, mostrado con permiso del laboratorio. Información tomada de la caja.' },
    specs: [
      { value: '8', label: 'Componentes', note: 'Vitaminas y minerales del frente' },
      { value: '1', label: 'Cápsula al día', note: 'Vía oral · adultos' },
      { value: '5', label: 'Cápsulas blandas', note: '0.810 g cada una' },
    ],
    notes: [
      { title: 'Biotina', text: '900 µg por porción (300% VDR).' },
      { title: 'Zinc', text: '20 mg por porción (133.33% VDR).' },
      { title: 'Selenio', text: '200 µg por porción (285.7% VDR).' },
    ],
    // la caja con sus fotos (photo) se agrega en src/data/vitybell.ts, que se carga en src/app/_layout.tsx
    arTitle: 'VITYBELL · Procaps',
    sizeCm: { w: 7, h: 4.3, d: 1.4 },
  },
];

products.forEach((p) => {
  // cada producto real tiene los suyos (PANCREOGEN usa los puntos de su frasco, en su propio catálogo)
  p.hotspots = p.id === 'cor' ? realSpots : p.id === 'tea' ? teaSpots : p.id === 'def' ? defSpots : p.id === 'vit' ? vitSpots : [];
});

// ---------- Visitas ----------
export const visits: Visit[] = [
  {
    id: 'vs1',
    doctorId: 'm1',
    dayOffset: 0,
    time: '15:30',
    place: 'Consultorio Dermatológico Toscano',
    address: 'Av. Ejemplo 123, Guayaquil (dirección ficticia)',
    status: 'Programada',
    productIds: ['vit', 'def'],
    notes: 'Presentar VITYBELL y dejar material de apoyo de DEFEROL.',
    lat: -2.161,
    lon: -79.901,
  },
  {
    id: 'vs2',
    doctorId: 'm4',
    dayOffset: 0,
    time: '17:00',
    place: 'Clínica Dermasur',
    address: 'Calle Demo 45, Durán (dirección ficticia)',
    status: 'Programada',
    productIds: ['vit'],
    notes: 'Seguimiento de la solicitud de información técnica de VITYBELL.',
    lat: -2.172,
    lon: -79.838,
  },
  {
    id: 'vs3',
    doctorId: 'm2',
    dayOffset: 1,
    time: '10:00',
    place: 'Centro Médico Los Ceibos',
    address: 'Av. Muestra 900, Guayaquil (dirección ficticia)',
    status: 'Programada',
    productIds: ['tea', 'def'],
    notes: 'Llevar la ficha y muestras de TEARSOFT.',
    lat: -2.159,
    lon: -79.953,
  },
  {
    id: 'vs4',
    doctorId: 'm3',
    dayOffset: 2,
    time: '09:00',
    place: 'Consultorio Benítez',
    address: 'Calle Ficticia 12, Milagro (dirección ficticia)',
    status: 'Reprogramada',
    productIds: ['cor', 'pan'],
    notes: 'La doctora pidió mover la visita al jueves.',
    lat: -2.134,
    lon: -79.59,
  },
  {
    id: 'vs5',
    doctorId: 'm1',
    dayOffset: -7,
    time: '16:00',
    place: 'Consultorio Dermatológico Toscano',
    address: 'Av. Ejemplo 123, Guayaquil (dirección ficticia)',
    status: 'Realizada',
    productIds: ['def', 'cor'],
    notes: 'Se presentaron DEFEROL y CORAESSENS. Interés en material de apoyo.',
    lat: -2.161,
    lon: -79.901,
    report: pastReport(-7, '16:00', 12, ['def', 'cor'], { def: { muestra: 4, impreso: 2 }, cor: { impreso: 3, digital: 1 } }, 'Alto', ['Dejar más material'], 'Se presentaron DEFEROL y CORAESSENS. Interés en material de apoyo.', 'Dra. Pamela Toscano'),
  },
  {
    id: 'vs6',
    doctorId: 'm2',
    dayOffset: -3,
    time: '10:30',
    place: 'Centro Médico Los Ceibos',
    address: 'Av. Muestra 900, Guayaquil (dirección ficticia)',
    status: 'Realizada',
    productIds: ['tea'],
    notes: 'Pidió la ficha digital antes de la próxima visita.',
    lat: -2.159,
    lon: -79.953,
    report: pastReport(-3, '10:30', 9, ['tea'], { tea: { muestra: 2, digital: 1 } }, 'Medio', ['Enviar información técnica'], 'Pidió la ficha digital antes de la próxima visita.', 'Dr. Andrés Villacís', 15),
  },
  {
    id: 'vs7',
    doctorId: 'm4',
    dayOffset: -5,
    time: '17:15',
    place: 'Clínica Dermasur',
    address: 'Calle Demo 45, Durán (dirección ficticia)',
    status: 'Realizada',
    productIds: ['vit', 'def'],
    notes: 'Quiere ver la información nutricional de VITYBELL en la próxima visita.',
    lat: -2.172,
    lon: -79.838,
    report: pastReport(-5, '17:15', 18, ['vit', 'def'], { vit: { muestra: 2, impreso: 1 }, def: { muestra: 3 } }, 'Alto', ['Agendar seguimiento'], 'Quiere ver la información nutricional de VITYBELL en la próxima visita.', 'Dr. Luis Ortega', 7),
  },
  {
    id: 'vs8',
    doctorId: 'm3',
    dayOffset: -12,
    time: '09:20',
    place: 'Consultorio Benítez',
    address: 'Calle Ficticia 12, Milagro (dirección ficticia)',
    status: 'Realizada',
    productIds: ['pan'],
    notes: '',
    lat: -2.134,
    lon: -79.59,
    report: pastReport(-12, '09:20', 7, ['pan'], { pan: { impreso: 2 } }, 'Bajo', ['Sin acciones'], '', 'Dra. Carla Benítez'),
  },
  {
    id: 'vs9',
    doctorId: 'm1',
    dayOffset: -21,
    time: '15:45',
    place: 'Consultorio Dermatológico Toscano',
    address: 'Av. Ejemplo 123, Guayaquil (dirección ficticia)',
    status: 'Realizada',
    productIds: ['cor'],
    notes: 'Primera visita. Presentación general de los productos.',
    lat: -2.161,
    lon: -79.901,
    report: pastReport(-21, '15:45', 15, ['cor'], { cor: { muestra: 3, impreso: 2, digital: 1 } }, 'Medio', ['Agendar seguimiento'], 'Primera visita. Presentación general de los productos.', 'Dra. Pamela Toscano', 15),
  },
];

// Registros de visitas pasadas (datos de demostración con una firma de ejemplo)
function pastReport(
  offset: number,
  time: string,
  minutes: number,
  presented: string[],
  deliveries: VisitReport['deliveries'],
  interest: Interest,
  nextSteps: NextStep[],
  notes: string,
  signer: string,
  followUpDays?: number,
): VisitReport {
  const [h, m] = time.split(':').map(Number);
  const start = dateFor(offset);
  start.setHours(h, m, 0, 0);
  const startedAt = start.getTime();
  const endedAt = startedAt + minutes * 60000;
  return {
    startedAt,
    endedAt,
    presented,
    deliveries,
    interest,
    nextSteps,
    followUpDays,
    notes,
    signature: {
      w: 340,
      h: 200,
      name: signer,
      at: endedAt,
      paths: [
        'M40 130 Q60 70 80 120 Q95 160 115 110 Q130 70 150 125 Q165 150 185 105',
        'M190 115 Q215 80 235 120 Q250 145 275 100 L300 95',
        'M70 150 L290 140',
      ],
    },
  };
}

// ---------- Solicitudes ----------
export const requests: RequestItem[] = [
  {
    id: 'r1',
    code: 'SOL-0142',
    productId: 'vit',
    type: 'Material de apoyo',
    urgency: 'Sin prisa',
    notes: 'Material impreso para la sala de espera.',
    doctorId: 'm1',
    repId: 'v1',
    status: 'En proceso',
    history: [
      { status: 'Pendiente', at: 'Hace 5 días' },
      { status: 'Recibida', at: 'Hace 5 días' },
      { status: 'En revisión', at: 'Hace 4 días' },
      { status: 'En proceso', at: 'Hace 2 días' },
    ],
    createdAt: 'Hace 5 días',
  },
  {
    id: 'r2',
    code: 'SOL-0138',
    productId: 'def',
    type: 'Información técnica',
    notes: 'Ficha técnica completa en PDF.',
    doctorId: 'm1',
    repId: 'v1',
    status: 'Atendida',
    history: [
      { status: 'Pendiente', at: 'Hace 9 días' },
      { status: 'Recibida', at: 'Hace 9 días' },
      { status: 'En revisión', at: 'Hace 8 días' },
      { status: 'En proceso', at: 'Hace 8 días' },
      { status: 'Atendida', at: 'Hace 7 días' },
    ],
    createdAt: 'Hace 9 días',
  },
  {
    id: 'r3',
    code: 'SOL-0145',
    productId: 'vit',
    type: 'Información técnica',
    urgency: 'Esta semana',
    notes: '¿Tienen la ficha con la información nutricional completa?',
    doctorId: 'm4',
    repId: 'v1',
    status: 'Pendiente',
    history: [{ status: 'Pendiente', at: 'Hace 3 horas' }],
    createdAt: 'Hace 3 horas',
  },
];

// ---------- Chats ----------
export const chats: Chat[] = [
  {
    id: 'c1',
    members: ['m1', 'v1'],
    unreadFor: { m1: 1, v1: 0 },
    messages: [
      { id: 'c1m1', from: 'v1', text: 'Buenas tardes, doctora. Le confirmo la visita de hoy a las 15:30.', at: '10:02' },
      { id: 'c1m2', from: 'm1', text: 'Perfecto, Juan. ¿Puede traer información de VITYBELL?', at: '10:15' },
      { id: 'c1m3', from: 'v1', text: 'Claro, le comparto la ficha para que la revise antes.', at: '10:16', productId: 'vit' },
    ],
  },
  {
    id: 'c2',
    members: ['m4', 'v1'],
    unreadFor: { m4: 0, v1: 2 },
    messages: [
      { id: 'c2m1', from: 'm4', text: 'Juan, envié una solicitud de información de VITYBELL.', at: 'Ayer' },
      { id: 'c2m2', from: 'm4', text: '¿Me la puede traer en la próxima visita?', at: 'Ayer' },
    ],
  },
];

// ---------- Notificaciones ----------
export const notices: Notice[] = [
  { id: 'n1', forRole: 'medico', kind: 'mensaje', title: 'Nuevo mensaje de Juan Carlos Mieles', body: 'Le compartió la ficha de VITYBELL.', at: 'Hace 1 h', read: false, href: '/chat/c1' },
  { id: 'n2', forRole: 'medico', kind: 'solicitud', title: 'Solicitud SOL-0142 en proceso', body: 'Su solicitud de material de apoyo avanzó de estado.', at: 'Hace 2 días', read: false, href: '/solicitud/r1' },
  { id: 'n3', forRole: 'medico', kind: 'visita', title: 'Visita confirmada', body: 'Juan Carlos Mieles pasará hoy a las 15:30 por su consultorio.', at: 'Hace 3 h', read: true, href: '/visita/vs1' },
  { id: 'n4', forRole: 'visitador', kind: 'solicitud', title: 'Nueva solicitud de Dr. Luis Ortega', body: 'Información técnica de VITYBELL.', at: 'Hace 3 h', read: false, href: '/solicitud/r3' },
  { id: 'n5', forRole: 'visitador', kind: 'visita', title: 'Recordatorio de visita', body: 'Hoy 15:30 con Dra. Pamela Toscano.', at: 'Hace 4 h', read: false, href: '/visita/vs1' },
  { id: 'n6', forRole: 'visitador', kind: 'mensaje', title: '2 mensajes de Dr. Luis Ortega', body: '¿Me la puede traer en la próxima visita?', at: 'Ayer', read: true, href: '/chat/c2' },
];

// ---------- Estado del profesional ----------
export type DoctorState = 'libre' | 'consulta' | 'ausente';
export interface DoctorStatus {
  state: DoctorState;
  until?: string; // texto corto: "hasta 16:30"
  at: number;
}
export const DOCTOR_STATES: { state: DoctorState; label: string; short: string; icon: IconName }[] = [
  { state: 'libre', label: 'Libre para visitas', short: 'Libre', icon: 'checkmark-circle' },
  { state: 'consulta', label: 'En consulta', short: 'En consulta', icon: 'medkit' },
  { state: 'ausente', label: 'No disponible', short: 'No disponible', icon: 'moon' },
];
export const initialDoctorStatus: Record<string, DoctorStatus> = {
  m1: { state: 'libre', at: Date.now() - 20 * 60000 },
  m2: { state: 'consulta', until: 'hasta 12:00', at: Date.now() - 45 * 60000 },
  m3: { state: 'ausente', at: Date.now() - 3 * 3600000 },
  m4: { state: 'consulta', until: 'por 1 hora', at: Date.now() - 10 * 60000 },
};

// ---------- Necesidad de producto (palabras clave del médico) ----------
// El médico describe lo que busca y el visitador recibe los productos de su catálogo que coinciden.
// No es un pedido ni una compra: el visitador responde con información, muestras o una visita.
export type NeedUrgency = 'Sin prisa' | 'Esta semana' | 'Lo antes posible';
export type NeedStatus = 'Enviada' | 'Vista' | 'Atendida';
export const NEED_RESPONSES = ['Le comparto la ficha por chat', 'Llevaré muestras en la próxima visita', 'Agendemos una visita', 'No tengo un producto que coincida'] as const;
export interface ProductNeed {
  id: string;
  doctorId: string;
  keywords: string[];
  note: string;
  urgency: NeedUrgency;
  status: NeedStatus;
  createdAt: number;
  response?: string;
  respondedAt?: number;
}
export const NEED_SUGGESTIONS = ['vitamina d', 'cabello', 'uñas', 'ojo seco', 'gotas', 'suplemento', 'biotina', 'magnesio', 'vitamina b12', 'zinc'];

export const initialNeeds: ProductNeed[] = [
  {
    id: 'nd1',
    doctorId: 'm4',
    keywords: ['cabello', 'uñas'],
    note: 'Busco información de algún suplemento para cabello y uñas para mostrar en consulta.',
    urgency: 'Esta semana',
    status: 'Enviada',
    createdAt: Date.now() - 2 * 3600000,
  },
];

/** quita tildes y mayúsculas para comparar palabras */
export const normalize = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export interface ProductMatch {
  product: Product;
  hits: string[]; // palabras clave del médico que coincidieron
  score: number;
}

/** Productos que coinciden con las palabras clave, del más al menos relevante (opcional: solo de un laboratorio) */
export function matchProducts(keywords: string[], lab?: string | string[]): ProductMatch[] {
  const keys = keywords.map(normalize).filter(Boolean);
  if (!keys.length) return [];
  return products
    .filter((p) => !lab || (Array.isArray(lab) ? lab.includes(p.lab) : p.lab === lab))
    .map((p) => {
      const tags = (p.keywords ?? []).map(normalize);
      const text = normalize([p.name, p.lab, p.category, p.tagline, p.description, p.form, p.component, ...p.uses].join(' '));
      let score = 0;
      const hits: string[] = [];
      keywords.forEach((k, i) => {
        const key = keys[i];
        if (!key) return;
        const words = key.split(/\s+/).filter((w) => w.length > 2);
        let pts = 0;
        if (tags.some((t) => t === key)) pts = 3;
        else if (tags.some((t) => t.includes(key) || ` ${key} `.includes(` ${t} `))) pts = 2;
        else if (text.includes(key)) pts = 2;
        else if (words.length && words.every((w) => text.includes(w) || tags.some((t) => t.includes(w)))) pts = 1;
        if (pts) {
          score += pts;
          hits.push(k);
        }
      });
      return { product: p, hits, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ---------- Devoluciones de material ----------
// El médico reporta material recibido (muestras de demostración o material de apoyo) que llegó en mal estado.
// No es una devolución de compra: el visitador lo revisa, retira o repone en su próxima visita.
export type ReturnStatus = 'Reportada' | 'Recibida' | 'En revisión' | 'Retiro agendado' | 'Resuelta' | 'Cancelada';
export const RETURN_FLOW: ReturnStatus[] = ['Reportada', 'Recibida', 'En revisión', 'Retiro agendado', 'Resuelta'];
export const RETURN_REASONS: { label: string; icon: IconName }[] = [
  { label: 'Llegó dañado', icon: 'warning-outline' },
  { label: 'Empaque abierto', icon: 'cube-outline' },
  { label: 'Fecha de vencimiento próxima', icon: 'calendar-outline' },
  { label: 'Producto equivocado', icon: 'swap-horizontal-outline' },
  { label: 'Cantidad incompleta', icon: 'remove-circle-outline' },
  { label: 'Otro motivo', icon: 'ellipsis-horizontal-circle-outline' },
];
export const RETURN_WANTS = ['Reposición', 'Retiro del material', 'Solo informar'] as const;
export type ReturnWant = (typeof RETURN_WANTS)[number];

export interface ReturnSource {
  kind: 'visita' | 'solicitud';
  id: string; // id de visita o solicitud
  label: string; // "Visita del 7 oct" / "SOL-0142"
}

export interface ReturnItem {
  id: string;
  code: string;
  doctorId: string;
  repId: string;
  source: ReturnSource;
  productId: string;
  material: string; // "Muestras de demostración", "Material impreso"...
  qty: number;
  reason: string;
  detail: string;
  want: ReturnWant;
  photos: string[];
  status: ReturnStatus;
  history: { status: ReturnStatus; at: number; note?: string }[];
  createdAt: number;
}

export const initialReturns: ReturnItem[] = [
  {
    id: 'dv1',
    code: 'DEV-0007',
    doctorId: 'm4',
    repId: 'v1',
    source: { kind: 'visita', id: 'vs7', label: 'Visita del ' + new Date(Date.now() - 5 * 864e5).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }) },
    productId: 'vit',
    material: 'Muestras de demostración',
    qty: 1,
    reason: 'Empaque abierto',
    detail: 'Una de las muestras llegó con el sello roto.',
    want: 'Reposición',
    photos: [],
    status: 'Recibida',
    history: [
      { status: 'Reportada', at: Date.now() - 26 * 3600000 },
      { status: 'Recibida', at: Date.now() - 20 * 3600000 },
    ],
    createdAt: Date.now() - 26 * 3600000,
  },
];

// ---------- Utilidades ----------
export const personById = (id: string) => people.find((p) => p.id === id)!;
export const productById = (id: string) => products.find((p) => p.id === id);

export function dayLabel(offset: number) {
  if (offset === 0) return 'Hoy';
  if (offset === 1) return 'Mañana';
  if (offset === -1) return 'Ayer';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function dateFor(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}
