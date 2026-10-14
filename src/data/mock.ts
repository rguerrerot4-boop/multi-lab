// Datos simulados para el prototipo académico Multi LAB.
// Todas las personas, laboratorios y productos son FICTICIOS.
// No representan medicamentos reales ni indicaciones médicas aprobadas.

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

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

export type RequestType = 'Información técnica' | 'Material de apoyo' | 'Agendar visita';

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
  face: 'front' | 'right' | 'back' | 'left' | 'top';
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
}

// Puntos interactivos del visor 3D (textos de demostración)
const spots = (p: Omit<Product, 'hotspots'>): Hotspot[] => [
  { face: 'front', u: 0.5, v: 0.4, title: p.name, text: `${p.tagline}. ${p.description.split('.')[0]}.` },
  { face: 'front', u: 0.82, v: 0.8, title: 'Presentación', text: `${p.form}. Componente principal: ${p.component}.` },
  { face: 'right', u: 0.5, v: 0.55, title: 'Usos descritos', text: `${p.uses.join(' · ')}. Texto de ejemplo, no son indicaciones aprobadas.` },
  { face: 'back', u: 0.3, v: 0.3, title: 'Modo de uso', text: p.howTo.map((h, i) => `${i + 1}. ${h}`).join('  ') },
  { face: 'left', u: 0.5, v: 0.7, title: 'Precauciones', text: p.precautions.join(' · ') },
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
  p3: { muestra: 6, impreso: 20, digital: 99 },
  p4: { muestra: 20, impreso: 40, digital: 99 },
  p5: { muestra: 4, impreso: 15, digital: 99 },
};

export interface RequestItem {
  id: string;
  code: string;
  productId: string;
  type: RequestType;
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
    name: 'Juan Mieles',
    initials: 'JM',
    role: 'visitador',
    title: 'Visitador médico · Línea dermatológica',
    org: 'Laboratorio NovaBio (ficticio)',
    email: 'juan.mieles@demo-multilab.ec',
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
];

export const DEMO_USER: Record<Role, string> = { medico: 'm1', visitador: 'v1' };

// ---------- Productos (ficticios) ----------
export const categories = ['Todos', 'Limpieza', 'Hidratación', 'Reparación', 'Fotoprotección', 'Pediatría'];

export const products: Product[] = [
  {
    id: 'p1',
    name: 'DermaCleanse Gel',
    lab: 'NovaBio',
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
  },
  {
    id: 'p2',
    name: 'BioBarrier Emulsión',
    lab: 'NovaBio',
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
    isNew: true,
  },
  {
    id: 'p3',
    name: 'CeraRepair Bálsamo',
    lab: 'NovaBio',
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
  },
  {
    id: 'p4',
    name: 'PhotoBlock SPF 50+',
    lab: 'NovaBio',
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
  },
];

products.forEach((p) => {
  p.hotspots = spots(p);
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
    productIds: ['p5', 'p1'],
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
    productIds: ['p5'],
    notes: 'Pidió la ficha digital antes de la próxima visita.',
    lat: -2.159,
    lon: -79.953,
    report: pastReport(-3, '10:30', 9, ['p5'], { p5: { muestra: 2, digital: 1 } }, 'Medio', ['Enviar información técnica'], 'Pidió la ficha digital antes de la próxima visita.', 'Dr. Andrés Villacís', 15),
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
  { id: 'n1', forRole: 'medico', kind: 'mensaje', title: 'Nuevo mensaje de Juan Mieles', body: 'Le compartió la ficha de PhotoBlock SPF 50+.', at: 'Hace 1 h', read: false, href: '/chat/c1' },
  { id: 'n2', forRole: 'medico', kind: 'solicitud', title: 'Solicitud SOL-0142 en proceso', body: 'Su solicitud de material de apoyo avanzó de estado.', at: 'Hace 2 días', read: false, href: '/solicitud/r1' },
  { id: 'n3', forRole: 'medico', kind: 'producto', title: 'Novedad en el catálogo', body: 'BioBarrier Emulsión ya está disponible para consulta.', at: 'Hace 3 días', read: true, href: '/producto/p2' },
  { id: 'n4', forRole: 'visitador', kind: 'solicitud', title: 'Nueva solicitud de Dr. Luis Ortega', body: 'Información técnica de CeraRepair Bálsamo.', at: 'Hace 3 h', read: false, href: '/solicitud/r3' },
  { id: 'n5', forRole: 'visitador', kind: 'visita', title: 'Recordatorio de visita', body: 'Hoy 15:30 con Dra. Pamela Toscano.', at: 'Hace 4 h', read: false, href: '/visita/vs1' },
  { id: 'n6', forRole: 'visitador', kind: 'mensaje', title: '2 mensajes de Dr. Luis Ortega', body: '¿Me la puede traer en la próxima visita?', at: 'Ayer', read: true, href: '/chat/c2' },
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
