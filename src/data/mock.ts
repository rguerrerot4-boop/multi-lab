// Datos simulados para el prototipo académico Multi LAB.
// Todas las personas, laboratorios y productos son FICTICIOS.
// No representan medicamentos reales ni indicaciones médicas aprobadas.

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { BoxTextures } from '@/components/PhotoBox3D';

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
  areas: Area[]; // especialidades a las que se dirige la información (ficticio)
  /** producto real mostrado con permiso del laboratorio (texto tomado del empaque) */
  real?: { note: string };
  /** caja 3D con las fotos del empaque (vitrina 3D) */
  photo?: { textures: BoxTextures; dims: { w: number; h: number; d: number }; vitrina: string };
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

export type Area = 'Dermatología' | 'Pediatría' | 'Medicina general';

// ---------- Laboratorios (ficticios) ----------
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
  { id: 'celvia', name: 'Celvia', full: 'Laboratorios Celvia', repId: 'v1', tagline: 'Dermocosmética y cuidado de la piel', hue: '#1E7F8C' },
  { id: 'andina', name: 'Andina Pharma', full: 'Laboratorio Andina Pharma', repId: 'v2', tagline: 'Línea pediátrica', hue: '#63C9D6' },
  { id: 'bioandes', name: 'Bioandes', full: 'Bioandes Salud', repId: 'v3', tagline: 'Cuidado de uso diario', hue: '#20343A' },
  // laboratorio real: su producto se muestra con permiso (en la demo lo atiende el mismo visitador de Celvia)
  { id: 'nutrabiotics', name: 'Nutrabiotics', full: 'Nutrabiotics', repId: 'v1', tagline: 'Suplementos · producto real con permiso', hue: '#C9262F', real: true }, // rojo del empaque (packColors.coraessens.red)
];
export const labByName = (name: string) => labs.find((l) => l.name === name);
export const labOfRep = (repId: string) => labs.find((l) => l.repId === repId);
/** Laboratorios que atiende un visitador */
export const repLabNames = (repId: string) => labs.filter((l) => l.repId === repId).map((l) => l.name);
/** Productos de los laboratorios que atiende un visitador */
export const repProducts = (repId: string) => products.filter((p) => labs.some((l) => l.repId === repId && l.name === p.lab));

/** Área del médico según su especialidad */
export const areaOf = (title: string): Area =>
  /pediatr/i.test(title) ? 'Pediatría' : /dermat/i.test(title) ? 'Dermatología' : 'Medicina general';

// Puntos interactivos del visor 3D (textos de demostración)
const spots = (p: Omit<Product, 'hotspots'>): Hotspot[] => [
  { face: 'front', u: 0.5, v: 0.4, title: p.name, text: `${p.tagline}. ${p.description.split('.')[0]}.` },
  { face: 'front', u: 0.82, v: 0.8, title: 'Presentación', text: `${p.form}. Componente principal: ${p.component}.` },
  { face: 'right', u: 0.5, v: 0.55, title: 'Usos descritos', text: `${p.uses.join(' · ')}. Texto de ejemplo, no son indicaciones aprobadas.` },
  { face: 'back', u: 0.3, v: 0.3, title: 'Modo de uso', text: p.howTo.map((h, i) => `${i + 1}. ${h}`).join('  ') },
  { face: 'left', u: 0.5, v: 0.7, title: 'Precauciones', text: p.precautions.join(' · ') },
];

// Puntos del visor 3D de CORAESSENS, con el texto impreso en cada cara
const realSpots: Hotspot[] = [
  { face: 'front', u: 0.42, v: 0.12, title: 'CORAESSENS®', text: 'Fórmula a base de corazón bovino liofilizado, magnesio, metilcobalamina, piridoxal-5-fosfato y L-5 MTHF. 9 cápsulas.' },
  { face: 'front', u: 0.5, v: 0.93, title: 'Muestra médica', text: 'Muestra · prohibida su venta.' },
  { face: 'left', u: 0.5, v: 0.1, title: 'Modo de empleo', text: 'Vía oral: adultos mayores a 18 años tomar 1 cápsula 3 veces al día, con cada comida.' },
  { face: 'left', u: 0.5, v: 0.45, title: 'Composición por cápsula', text: 'Corazón bovino liofilizado 275 mg · óxido de magnesio 145 mg · piridoxal-5-fosfato 25 mg · palmitato de ascorbilo 10 mg · metilcobalamina 650 mcg · L-5 metiltetrahidrofolato-calcio 326 mcg.' },
  { face: 'right', u: 0.5, v: 0.4, title: 'Información nutricional', text: 'Porción diaria: 3 cápsulas. Folacina 900 mcg · vitamina B6 75 mg · vitamina B12 1950 mcg · vitamina C 12,75 mg · magnesio 332,55 mg.' },
  { face: 'back', u: 0.5, v: 0.25, title: 'Advertencias', text: 'Manténgase fuera del alcance de los niños. No superar la dosis recomendada. No use el producto si el sello de seguridad está roto o despegado.' },
  { face: 'back', u: 0.4, v: 0.82, title: 'Lote de la muestra', text: 'LOT 25-211 · FAB oct-2025 · EXP oct-2027.' },
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
  m1: { hours: 'Lun a vie · 14:00 a 19:00', prefers: 'Visitas cortas, máximo 10 min', patients: 'Adultos con piel sensible', tip: 'Le interesa el material para la sala de espera.' },
  m2: { hours: 'Lun a sáb · 08:00 a 13:00', prefers: 'Material visual y digital', patients: 'Niños de 0 a 12 años', tip: 'Prefiere recibir fichas por chat antes de la visita.' },
  m3: { hours: 'Mar y jue · 09:00 a 16:00', prefers: 'Visitas con cita previa', patients: 'Medicina familiar', tip: 'Pidió reprogramar visitas con un día de aviso.' },
  m4: { hours: 'Lun a vie · 15:00 a 20:00', prefers: 'Información técnica detallada', patients: 'Dermatología clínica', tip: 'Tiene una solicitud de información técnica abierta.' },
};

// Kit de material de demostración del visitador (cantidades iniciales ficticias)
export const INITIAL_KIT: Record<string, Record<DeliveryKind, number>> = {
  p1: { muestra: 18, impreso: 30, digital: 99 },
  p2: { muestra: 12, impreso: 25, digital: 99 },
  p3: { muestra: 5, impreso: 20, digital: 99 },
  p4: { muestra: 20, impreso: 40, digital: 99 },
  cor: { muestra: 10, impreso: 15, digital: 99 },
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
    title: 'Visitador médico · Línea dermatológica',
    org: 'Laboratorios Celvia (ficticio)',
    email: 'juancarlos.mieles@demo-multilab.ec',
    phone: '+593 98 000 0202',
    city: 'Guayaquil',
  },
  {
    id: 'm2',
    name: 'Dr. Andrés Villacís',
    initials: 'AV',
    role: 'medico',
    title: 'Pediatra',
    org: 'Centro Médico Los Ceibos (ficticio)',
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
  {
    id: 'v2',
    name: 'Andrea Morales',
    initials: 'AM',
    role: 'visitador',
    title: 'Visitadora médica · Línea pediátrica',
    org: 'Laboratorio Andina Pharma (ficticio)',
    email: 'andrea.morales@demo-multilab.ec',
    phone: '+593 98 000 0606',
    city: 'Guayaquil',
  },
  {
    id: 'v3',
    name: 'Gabriela Rosales',
    initials: 'GR',
    role: 'visitador',
    title: 'Visitadora médica · Cuidado diario',
    org: 'Bioandes Salud (ficticio)',
    email: 'gabriela.rosales@demo-multilab.ec',
    phone: '+593 98 000 0707',
    city: 'Milagro',
  },
];

export const DEMO_USER: Record<Role, string> = { medico: 'm1', visitador: 'v1' };

// ---------- Productos (ficticios) ----------
export const categories = ['Todos', 'Limpieza', 'Hidratación', 'Reparación', 'Fotoprotección', 'Pediatría', 'Suplementos'];

export const products: Product[] = [
  {
    id: 'p1',
    name: 'DermaCleanse Gel',
    lab: 'Celvia',
    category: 'Limpieza',
    form: 'Gel limpiador · frasco 200 ml',
    component: 'Agentes limpiadores suaves (ilustrativo)',
    concentration: 'No aplica',
    tagline: 'Limpieza suave de uso diario',
    description:
      'Gel de limpieza facial de textura ligera. Producto ficticio creado para demostrar cómo se presenta una ficha dentro de Multi LAB.',
    uses: ['Limpieza facial diaria', 'Piel mixta a grasa (descripción de ejemplo)'],
    howTo: ['Aplicar sobre la piel húmeda', 'Masajear suavemente durante 30 segundos', 'Enjuagar con abundante agua'],
    precautions: ['Uso externo', 'Evitar el contacto con los ojos', 'Suspender el uso si aparece irritación'],
    docs: ['Ficha técnica (demo).pdf', 'Guía de presentación (demo).pdf'],
    slides: [
      { title: 'Limpieza sin resecar', body: 'Mensaje clave de la línea: limpiar respetando la barrera de la piel.', icon: 'water-outline' },
      { title: 'Rutina en 3 pasos', body: 'Humedecer, masajear y enjuagar. Pensado para uso mañana y noche.', icon: 'repeat-outline' },
      { title: 'Presentación', body: 'Frasco de 200 ml con dosificador. Material de apoyo disponible a solicitud.', icon: 'cube-outline' },
    ],
    icon: 'water-outline',
    hue: '#63C9D6',
    keywords: ['limpiador', 'limpieza', 'gel', 'rostro', 'piel grasa', 'piel mixta', 'uso diario'],
    areas: ['Dermatología', 'Medicina general'],
  },
  {
    id: 'p2',
    name: 'BioBarrier Emulsión',
    lab: 'Celvia',
    category: 'Hidratación',
    form: 'Emulsión · tubo 50 ml',
    component: 'Complejo hidratante (ilustrativo)',
    concentration: 'No aplica',
    tagline: 'Hidratación ligera de rápida absorción',
    description:
      'Emulsión hidratante de textura no grasa. Producto ficticio para el prototipo; la información es solo de demostración.',
    uses: ['Hidratación diaria', 'Complemento de rutinas de cuidado (ejemplo)'],
    howTo: ['Aplicar sobre la piel limpia', 'Extender hasta su absorción', 'Usar mañana y noche'],
    precautions: ['Uso externo', 'Mantener fuera del alcance de los niños'],
    docs: ['Ficha técnica (demo).pdf'],
    slides: [
      { title: 'Textura ligera', body: 'Se absorbe rápido y no deja sensación grasa.', icon: 'sparkles-outline' },
      { title: 'Uso diario', body: 'Se integra después de la limpieza, mañana y noche.', icon: 'sunny-outline' },
      { title: 'Presentación', body: 'Tubo de 50 ml.', icon: 'cube-outline' },
    ],
    icon: 'leaf-outline',
    hue: '#1E7F8C',
    keywords: ['hidratante', 'hidratación', 'emulsión', 'piel seca', 'textura ligera', 'uso diario'],
    areas: ['Dermatología', 'Medicina general'],
    isNew: true,
  },
  {
    id: 'p3',
    name: 'CeraRepair Bálsamo',
    lab: 'Celvia',
    category: 'Reparación',
    form: 'Bálsamo · tubo 40 g',
    component: 'Complejo de ceramidas (ilustrativo)',
    concentration: 'No aplica',
    tagline: 'Bálsamo de textura densa para zonas secas',
    description:
      'Bálsamo de cuidado para zonas resecas. Producto ficticio; los textos no constituyen indicaciones médicas.',
    uses: ['Zonas secas o ásperas (descripción de ejemplo)', 'Manos, codos y talones'],
    howTo: ['Aplicar una capa fina', 'Masajear hasta integrar', 'Repetir según necesidad'],
    precautions: ['Uso externo', 'No aplicar sobre heridas abiertas'],
    docs: ['Ficha técnica (demo).pdf', 'Infografía (demo).png'],
    slides: [
      { title: 'Zonas secas', body: 'Pensado para áreas que necesitan una textura más densa.', icon: 'hand-left-outline' },
      { title: 'Cómo se usa', body: 'Capa fina, masaje suave y repetir según necesidad.', icon: 'finger-print-outline' },
      { title: 'Presentación', body: 'Tubo de 40 g.', icon: 'cube-outline' },
    ],
    icon: 'bandage-outline',
    hue: '#20343A',
    keywords: ['ceramidas', 'bálsamo', 'reparador', 'resequedad', 'piel seca', 'zonas secas', 'barrera'],
    areas: ['Dermatología'],
  },
  {
    id: 'p4',
    name: 'PhotoBlock SPF 50+',
    lab: 'Celvia',
    category: 'Fotoprotección',
    form: 'Fluido · frasco 50 ml',
    component: 'Filtros solares (ilustrativo)',
    concentration: 'FPS 50+ (dato de ejemplo)',
    tagline: 'Fluido de protección solar de toque seco',
    description:
      'Fotoprotector en fluido de toque seco. Producto ficticio: los valores mostrados son de ejemplo y no provienen de estudios reales.',
    uses: ['Protección solar diaria (ejemplo)', 'Actividades al aire libre'],
    howTo: ['Aplicar 20 minutos antes de la exposición', 'Reaplicar cada 2 horas', 'Reaplicar después de nadar o sudar'],
    precautions: ['Uso externo', 'Evitar el contacto con los ojos', 'No sustituye otras medidas de protección'],
    docs: ['Ficha técnica (demo).pdf', 'Guía de reaplicación (demo).pdf'],
    slides: [
      { title: 'Toque seco', body: 'Textura fluida que no deja residuo blanco (mensaje de ejemplo).', icon: 'sunny-outline' },
      { title: 'Reaplicación', body: 'Cada 2 horas y después de nadar o sudar.', icon: 'time-outline' },
      { title: 'Presentación', body: 'Frasco de 50 ml.', icon: 'cube-outline' },
    ],
    icon: 'sunny-outline',
    hue: '#63C9D6',
    keywords: ['protector solar', 'sol', 'spf', 'fotoprotección', 'bloqueador', 'fluido'],
    areas: ['Dermatología', 'Medicina general', 'Pediatría'],
    isNew: true,
  },
  {
    id: 'p5',
    name: 'PediaCalm Crema',
    lab: 'Andina Pharma',
    category: 'Pediatría',
    form: 'Crema · tubo 60 g',
    component: 'Base emoliente (ilustrativo)',
    concentration: 'No aplica',
    tagline: 'Crema emoliente de uso familiar',
    description: 'Crema emoliente de textura suave. Producto ficticio para demostrar un segundo laboratorio en el catálogo.',
    uses: ['Cuidado de piel seca (descripción de ejemplo)'],
    howTo: ['Aplicar sobre la piel limpia y seca', 'Extender suavemente'],
    precautions: ['Uso externo', 'Consultar con el profesional de salud antes de usar en bebés'],
    docs: ['Ficha técnica (demo).pdf'],
    slides: [
      { title: 'Textura suave', body: 'Crema de fácil aplicación para uso familiar.', icon: 'heart-outline' },
      { title: 'Presentación', body: 'Tubo de 60 g.', icon: 'cube-outline' },
    ],
    icon: 'happy-outline',
    hue: '#1E7F8C',
    keywords: ['niños', 'bebé', 'pediátrico', 'pediatría', 'crema', 'piel sensible'],
    areas: ['Pediatría'],
  },  {
    id: 'p6',
    name: 'AloeFresh Gel',
    lab: 'Bioandes',
    category: 'Hidratación',
    form: 'Gel · frasco 150 ml',
    component: 'Extracto de aloe (ilustrativo)',
    concentration: 'No aplica',
    tagline: 'Gel refrescante de aloe para uso diario',
    description: 'Gel cosmético de textura fresca. Producto ficticio de un tercer laboratorio de demostración.',
    uses: ['Sensación de frescura en la piel', 'Uso cosmético diario (descripción de ejemplo)'],
    howTo: ['Aplicar una capa fina', 'Dejar absorber sin enjuagar'],
    precautions: ['Uso externo', 'Evitar el contacto con los ojos'],
    docs: ['Ficha técnica (demo).pdf'],
    slides: [
      { title: 'Frescura inmediata', body: 'Textura en gel que se absorbe rápido.', icon: 'leaf-outline' },
      { title: 'Presentación', body: 'Frasco de 150 ml.', icon: 'cube-outline' },
    ],
    icon: 'leaf-outline',
    hue: '#1E7F8C',
    keywords: ['aloe', 'gel', 'refrescante', 'frescura', 'después del sol', 'piel sensible'],
    areas: ['Medicina general', 'Dermatología'],
  },
  {
    id: 'p7',
    name: 'ManoProtect Crema',
    lab: 'Bioandes',
    category: 'Reparación',
    form: 'Crema de manos · tubo 75 ml',
    component: 'Base emoliente (ilustrativo)',
    concentration: 'No aplica',
    tagline: 'Crema de manos para lavados frecuentes',
    description: 'Crema de manos de absorción rápida. Producto ficticio pensado para mostrar material de uso diario en consultorio.',
    uses: ['Cuidado de manos con lavado frecuente (ejemplo)'],
    howTo: ['Aplicar sobre las manos secas', 'Masajear hasta absorber'],
    precautions: ['Uso externo', 'Suspender el uso si aparece irritación'],
    docs: ['Ficha técnica (demo).pdf'],
    slides: [
      { title: 'Manos cuidadas', body: 'Pensada para el uso diario del personal de salud.', icon: 'hand-left-outline' },
      { title: 'Presentación', body: 'Tubo de 75 ml.', icon: 'cube-outline' },
    ],
    icon: 'hand-left-outline',
    hue: '#20343A',
    keywords: ['manos', 'crema de manos', 'resequedad', 'lavado frecuente', 'piel seca'],
    areas: ['Medicina general'],
  },
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
    keywords: ['suplemento', 'suplemento dietario', 'cápsulas', 'magnesio', 'vitamina b12', 'metilcobalamina', 'vitamina b6', 'folato', 'corazón bovino', 'oral'],
    areas: ['Medicina general', 'Dermatología'],
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
];

products.forEach((p) => {
  p.hotspots = p.real ? realSpots : spots(p);
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
    productIds: ['p4', 'p2'],
    notes: 'Presentar el nuevo fotoprotector y dejar material de apoyo.',
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
    productIds: ['p3'],
    notes: 'Seguimiento de la solicitud de información técnica.',
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
    productIds: ['p4', 'p2'],
    notes: '',
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
    productIds: ['p1'],
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
    productIds: ['p1', 'p3'],
    notes: 'Se presentó la línea de limpieza. Interés en material de apoyo.',
    lat: -2.161,
    lon: -79.901,
    report: pastReport(-7, '16:00', 12, ['p1', 'p3'], { p1: { muestra: 4, impreso: 2 }, p3: { impreso: 3, digital: 1 } }, 'Alto', ['Dejar más material'], 'Se presentó la línea de limpieza. Interés en material de apoyo.', 'Dra. Pamela Toscano'),
  },
  {
    id: 'vs6',
    doctorId: 'm2',
    dayOffset: -3,
    time: '10:30',
    place: 'Centro Médico Los Ceibos',
    address: 'Av. Muestra 900, Guayaquil (dirección ficticia)',
    status: 'Realizada',
    productIds: ['p4'],
    notes: 'Pidió la ficha digital antes de la próxima visita.',
    lat: -2.159,
    lon: -79.953,
    report: pastReport(-3, '10:30', 9, ['p4'], { p4: { muestra: 2, digital: 1 } }, 'Medio', ['Enviar información técnica'], 'Pidió la ficha digital antes de la próxima visita.', 'Dr. Andrés Villacís', 15),
  },
  {
    id: 'vs7',
    doctorId: 'm4',
    dayOffset: -5,
    time: '17:15',
    place: 'Clínica Dermasur',
    address: 'Calle Demo 45, Durán (dirección ficticia)',
    status: 'Realizada',
    productIds: ['p3', 'p2'],
    notes: 'Quiere comparar texturas en la próxima visita.',
    lat: -2.172,
    lon: -79.838,
    report: pastReport(-5, '17:15', 18, ['p3', 'p2'], { p3: { muestra: 2, impreso: 1 }, p2: { muestra: 3 } }, 'Alto', ['Agendar seguimiento'], 'Quiere comparar texturas en la próxima visita.', 'Dr. Luis Ortega', 7),
  },
  {
    id: 'vs8',
    doctorId: 'm3',
    dayOffset: -12,
    time: '09:20',
    place: 'Consultorio Benítez',
    address: 'Calle Ficticia 12, Milagro (dirección ficticia)',
    status: 'Realizada',
    productIds: ['p1'],
    notes: '',
    lat: -2.134,
    lon: -79.59,
    report: pastReport(-12, '09:20', 7, ['p1'], { p1: { impreso: 2 } }, 'Bajo', ['Sin acciones'], '', 'Dra. Carla Benítez'),
  },
  {
    id: 'vs9',
    doctorId: 'm1',
    dayOffset: -21,
    time: '15:45',
    place: 'Consultorio Dermatológico Toscano',
    address: 'Av. Ejemplo 123, Guayaquil (dirección ficticia)',
    status: 'Realizada',
    productIds: ['p4'],
    notes: 'Primera visita. Presentación general del laboratorio.',
    lat: -2.161,
    lon: -79.901,
    report: pastReport(-21, '15:45', 15, ['p4'], { p4: { muestra: 3, impreso: 2, digital: 1 } }, 'Medio', ['Agendar seguimiento'], 'Primera visita. Presentación general del laboratorio.', 'Dra. Pamela Toscano', 15),
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
    productId: 'p3',
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
    productId: 'p1',
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
    productId: 'p3',
    type: 'Información técnica',
    urgency: 'Esta semana',
    notes: '¿Tienen material comparativo de la línea?',
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
      { id: 'c1m2', from: 'm1', text: 'Perfecto, Juan. ¿Puede traer información del nuevo fotoprotector?', at: '10:15' },
      { id: 'c1m3', from: 'v1', text: 'Claro, le comparto la ficha para que la revise antes.', at: '10:16', productId: 'p4' },
    ],
  },
  {
    id: 'c2',
    members: ['m4', 'v1'],
    unreadFor: { m4: 0, v1: 2 },
    messages: [
      { id: 'c2m1', from: 'm4', text: 'Juan, envié una solicitud de información del bálsamo.', at: 'Ayer' },
      { id: 'c2m2', from: 'm4', text: '¿Me la puede traer en la próxima visita?', at: 'Ayer' },
    ],
  },
  {
    id: 'c3',
    members: ['m1', 'v2'],
    unreadFor: { m1: 0, v2: 0 },
    messages: [{ id: 'c3m1', from: 'v2', text: 'Doctora, le dejé el material de PediaCalm en recepción.', at: 'Lun' }],
  },
];

// ---------- Notificaciones ----------
export const notices: Notice[] = [
  { id: 'n1', forRole: 'medico', kind: 'mensaje', title: 'Nuevo mensaje de Juan Carlos Mieles', body: 'Le compartió la ficha de PhotoBlock SPF 50+.', at: 'Hace 1 h', read: false, href: '/chat/c1' },
  { id: 'n2', forRole: 'medico', kind: 'solicitud', title: 'Solicitud SOL-0142 en proceso', body: 'Su solicitud de material de apoyo avanzó de estado.', at: 'Hace 2 días', read: false, href: '/solicitud/r1' },
  { id: 'n3', forRole: 'medico', kind: 'visita', title: 'Visita confirmada', body: 'Juan Carlos Mieles pasará hoy a las 15:30 por su consultorio.', at: 'Hace 3 h', read: true, href: '/visita/vs1' },
  { id: 'n4', forRole: 'visitador', kind: 'solicitud', title: 'Nueva solicitud de Dr. Luis Ortega', body: 'Información técnica de CeraRepair Bálsamo.', at: 'Hace 3 h', read: false, href: '/solicitud/r3' },
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
export const NEED_SUGGESTIONS = ['piel seca', 'protector solar', 'hidratante', 'niños', 'limpieza', 'ceramidas', 'piel sensible', 'textura ligera'];

export const initialNeeds: ProductNeed[] = [
  {
    id: 'nd1',
    doctorId: 'm4',
    keywords: ['ceramidas', 'zonas secas'],
    note: 'Busco algo de textura densa para mostrar en consulta.',
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
      const text = normalize([p.name, p.category, p.tagline, p.description, p.form, p.component, ...p.uses].join(' '));
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
    productId: 'p2',
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
