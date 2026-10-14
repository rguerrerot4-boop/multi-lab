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
}

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
  pin: { x: number; y: number }; // posición en el mapa ilustrativo (0-1)
}

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
    pin: { x: 0.42, y: 0.38 },
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
    pin: { x: 0.72, y: 0.55 },
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
    pin: { x: 0.2, y: 0.28 },
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
    pin: { x: 0.85, y: 0.8 },
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
    pin: { x: 0.42, y: 0.38 },
  },
];

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
