// «Multi», el asistente virtual del profesional de salud.
// Responde con los datos que ya tiene la app (visitas, material entregado, solicitudes, mensajes, productos…).
// No usa internet ni inventa nada: los textos de producto son los del empaque (src/data/mock.ts).
// Este archivo no importa nada de React Native, para que también lo use scripts/asistente/textos.mts.
import {
  DELIVERY_KINDS,
  DOCTOR_STATES,
  matchProducts,
  normalize,
  personById,
  productById,
  products,
  type Chat,
  type DoctorState,
  type DoctorStatus,
  type Notice,
  type Person,
  type Product,
  type ProductNeed,
  type RequestItem,
  type ReturnItem,
  type Visit,
} from '../data/mock.ts';

export const ASISTENTE = { name: 'Multi', wake: 'hola multi' };

export interface AsistenteCtx {
  me: Person;
  visits: Visit[]; // solo las del profesional
  requests: RequestItem[];
  chats: Chat[];
  notices: Notice[];
  needs: ProductNeed[];
  returns: ReturnItem[];
  status?: DoctorStatus;
}

export interface Respuesta {
  text: string;
  /** enlace para abrir la pantalla con el detalle */
  href?: string;
  hrefLabel?: string;
  /** acción que la app ejecuta al responder (cambiar el estado del profesional) */
  setStatus?: DoctorState;
  /** preguntas que se sugieren después */
  chips?: string[];
  /** la respuesta no encontró nada (para ofrecer ayuda) */
  miss?: boolean;
}

export const SUGERENCIAS = ['¿Quién me visitó por última vez?', '¿Qué productos me dejaron?', '¿Cuándo es mi próxima visita?', '¿Cómo van mis solicitudes?'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const frase = (t: string) => {
  const s = t.trim().replace(/\.$/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const minus = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** «hoy», «ayer», «hace 7 días», «mañana», «en 3 días» */
export function cuando(offset: number) {
  if (offset === 0) return 'hoy';
  if (offset === -1) return 'ayer';
  if (offset === 1) return 'mañana';
  if (offset === -7) return 'hace una semana';
  return offset < 0 ? `hace ${-offset} días` : `en ${offset} días`;
}

export const trato = (me: Person) => (/^dra\b/i.test(me.name) ? 'doctora' : 'doctor');
const nombres = (ids: string[]) => lista(ids.map((id) => productById(id)?.name ?? id));

function entregas(v: Visit) {
  const d = v.report?.deliveries ?? {};
  const partes: string[] = [];
  Object.entries(d).forEach(([pid, k]) => {
    const cosas = DELIVERY_KINDS.filter((x) => (k[x.kind] ?? 0) > 0).map((x) => plural(k[x.kind] ?? 0, x.one, x.many));
    if (cosas.length) partes.push(`${lista(cosas)} de ${productById(pid)?.name ?? pid}`);
  });
  return partes;
}

const hechas = (c: AsistenteCtx) => c.visits.filter((v) => v.status === 'Realizada').sort((a, b) => b.dayOffset - a.dayOffset || b.time.localeCompare(a.time));
const porVenir = (c: AsistenteCtx) =>
  c.visits.filter((v) => v.status !== 'Realizada' && v.dayOffset >= 0).sort((a, b) => a.dayOffset - b.dayOffset || a.time.localeCompare(b.time));
// en la demo todas las visitas las hace el visitador de los dos laboratorios
const visitador = () => personById('v1');
const labsDe = (rep: Person) => rep.org.replace(/ · /g, ' y ');

// ---------- respuestas ----------
function ultimaVisita(c: AsistenteCtx): Respuesta {
  const v = hechas(c)[0];
  if (!v) return { text: `Todavía no tiene visitas registradas, ${trato(c.me)}.`, chips: ['¿Cuándo es mi próxima visita?'] };
  const rep = visitador();
  const ent = entregas(v);
  return {
    text: `La última persona en visitarle fue ${rep.name}, visitador de ${labsDe(rep)}. Vino ${cuando(v.dayOffset)}, a las ${v.time}, y le presentó ${nombres(v.report?.presented.length ? v.report.presented : v.productIds)}.${ent.length ? ` Le dejó ${lista(ent)}.` : ''}`,
    href: `/visita/${v.id}`,
    hrefLabel: 'Ver esa visita',
    chips: ['¿Qué productos me dejaron?', '¿Cuándo es mi próxima visita?'],
  };
}

function productosDejados(c: AsistenteCtx): Respuesta {
  const con = hechas(c).filter((v) => entregas(v).length);
  if (!con.length) return { text: 'Todavía no le han dejado material en ninguna visita.', chips: ['¿Cuándo es mi próxima visita?'] };
  const v = con[0];
  const total: Record<string, number> = {};
  con.forEach((x) => Object.entries(x.report?.deliveries ?? {}).forEach(([pid, k]) => (total[pid] = (total[pid] ?? 0) + (k.muestra ?? 0))));
  const muestras = Object.entries(total).filter(([, n]) => n > 0);
  const resumen = muestras.length && con.length > 1 ? ` Sumando sus ${con.length} visitas, ha recibido ${lista(muestras.map(([pid, n]) => `${plural(n, 'muestra', 'muestras')} de ${productById(pid)?.name ?? pid}`))}.` : '';
  return {
    text: `En su última visita, ${cuando(v.dayOffset)}, le dejaron ${lista(entregas(v))}.${resumen}`,
    href: `/visita/${v.id}`,
    hrefLabel: 'Ver el detalle',
    chips: ['¿Quién me visitó por última vez?', 'Háblame de DEFEROL'],
  };
}

function proximaVisita(c: AsistenteCtx): Respuesta {
  const v = porVenir(c)[0];
  if (!v) return { text: 'No tiene visitas programadas por ahora. Si quiere, puede pedir una desde una solicitud.', href: '/solicitud/nueva', hrefLabel: 'Nueva solicitud' };
  const rep = visitador();
  return {
    text: `Su próxima visita es ${cuando(v.dayOffset)} a las ${v.time}, con ${rep.name}. Le va a presentar ${nombres(v.productIds)}.`,
    href: `/visita/${v.id}`,
    hrefLabel: 'Ver la visita',
    chips: ['¿Quién me visitó por última vez?', 'Ponme en consulta'],
  };
}

function cuantasVisitas(c: AsistenteCtx): Respuesta {
  const h = hechas(c);
  if (!h.length) return { text: 'Todavía no tiene visitas registradas.' };
  return {
    text: `Ha recibido ${plural(h.length, 'visita', 'visitas')}. La más reciente fue ${cuando(h[0].dayOffset)}${h.length > 1 ? ` y la primera, ${cuando(h[h.length - 1].dayOffset)}` : ''}.`,
    chips: ['¿Qué productos me dejaron?'],
  };
}

function solicitudes(c: AsistenteCtx): Respuesta {
  if (!c.requests.length) return { text: 'No tiene solicitudes todavía. Puede crear una cuando quiera.', href: '/solicitud/nueva', hrefLabel: 'Nueva solicitud' };
  const activas = c.requests.filter((r) => r.status !== 'Atendida' && r.status !== 'Cancelada');
  const una = (r: RequestItem) => `${r.code.replace('SOL-', 'la ')}, de ${minus(r.type)} de ${productById(r.productId)?.name ?? r.productId}, que está ${minus(r.status)}`;
  const cerradas = c.requests.length - activas.length;
  const text = activas.length
    ? `Tiene ${plural(activas.length, 'solicitud activa', 'solicitudes activas')}: ${lista(activas.map(una))}.${cerradas ? ` Y ${plural(cerradas, 'ya atendida', 'ya atendidas')}.` : ''}`
    : `No tiene solicitudes activas. Las ${c.requests.length} que hizo ya fueron atendidas.`;
  return { text, href: activas[0] ? `/solicitud/${activas[0].id}` : '/medico/solicitudes', hrefLabel: 'Ver solicitudes' };
}

function mensajes(c: AsistenteCtx): Respuesta {
  const sin = c.chats.reduce((s, ch) => s + (ch.unreadFor[c.me.id] ?? 0), 0);
  const ult = c.chats
    .map((ch) => ({ ch, m: ch.messages[ch.messages.length - 1] }))
    .filter((x) => x.m && x.m.from !== c.me.id)
    .pop();
  if (!c.chats.length || !ult) return { text: 'No tiene mensajes nuevos.', href: '/medico/mensajes', hrefLabel: 'Abrir mensajes' };
  return {
    text: `${sin ? `Tiene ${plural(sin, 'mensaje sin leer', 'mensajes sin leer')}.` : 'No tiene mensajes sin leer.'} El último es de ${personById(ult.m.from).name}: «${ult.m.text}»`,
    href: `/chat/${ult.ch.id}`,
    hrefLabel: 'Abrir el chat',
  };
}

function notificaciones(c: AsistenteCtx): Respuesta {
  const sin = c.notices.filter((n) => !n.read);
  if (!sin.length) return { text: 'No tiene notificaciones pendientes.', href: '/notificaciones', hrefLabel: 'Ver notificaciones' };
  return { text: `Tiene ${plural(sin.length, 'notificación sin leer', 'notificaciones sin leer')}. La más reciente: ${sin[0].title}.`, href: '/notificaciones', hrefLabel: 'Ver notificaciones' };
}

function miEstado(c: AsistenteCtx): Respuesta {
  const s = c.status?.state ?? 'libre';
  const label = DOCTOR_STATES.find((x) => x.state === s)?.label ?? s;
  return { text: `Ahora su estado es «${label}». Los visitadores lo ven antes de pasar por su consultorio.`, chips: ['Ponme en consulta', 'Ponme libre', 'Ponme no disponible'] };
}

function cambiarEstado(s: DoctorState): Respuesta {
  const texto: Record<DoctorState, string> = {
    libre: 'Listo. Su estado ahora es «Libre para visitas».',
    consulta: 'Listo. Le puse «En consulta», para que los visitadores esperen.',
    ausente: 'Listo. Su estado ahora es «No disponible».',
  };
  return { text: texto[s], setStatus: s };
}

function devoluciones(c: AsistenteCtx): Respuesta {
  if (!c.returns.length) return { text: 'No ha reportado material en mal estado. Si algo le llegó dañado, puede reportarlo desde la visita.' };
  const r = c.returns[0];
  return { text: `Tiene ${plural(c.returns.length, 'devolución', 'devoluciones')}. La ${r.code} de ${productById(r.productId)?.name ?? r.productId} está ${minus(r.status)}.`, href: `/devolucion/${r.id}`, hrefLabel: 'Ver la devolución' };
}

function necesidades(c: AsistenteCtx): Respuesta {
  if (!c.needs.length) return { text: 'No ha publicado búsquedas con «Necesito un producto». Dígame qué busca y le digo qué productos coinciden.' };
  const n = c.needs[0];
  return { text: `Su búsqueda de ${lista(n.keywords)} está ${minus(n.status)}.${n.response ? ` El visitador respondió: ${n.response}.` : ''}`, href: `/necesidad/${n.id}`, hrefLabel: 'Ver la búsqueda' };
}

function miVisitador(): Respuesta {
  const rep = visitador();
  return { text: `Su visitador es ${rep.name}, de ${labsDe(rep)}. Puede escribirle por el chat cuando quiera.`, href: '/medico/mensajes', hrefLabel: 'Abrir mensajes' };
}

function catalogo(): Respuesta {
  return {
    text: `Hay ${products.length} productos: ${[...new Set(products.map((p) => p.lab))].map((lab) => `${lista(products.filter((p) => p.lab === lab).map((p) => p.name))}, de ${lab}`).join('; y ')}. Pregúnteme por cualquiera.`,
    chips: products.slice(0, 3).map((p) => `Háblame de ${p.name}`),
  };
}

type Tema = 'general' | 'dosis' | 'usos' | 'composicion' | 'avisos';
export function infoProducto(p: Product, tema: Tema): Respuesta {
  const fuente = ' Es lo que dice su empaque.';
  const base = { href: `/producto/${p.id}`, hrefLabel: `Abrir ${p.name}` };
  const otros = [`¿Cómo se toma ${p.name}?`, `¿Qué contiene ${p.name}?`, `Precauciones de ${p.name}`];
  if (tema === 'dosis') return { ...base, text: `${p.name}: ${p.howTo.map(frase).join('. ')}.${fuente}`, chips: otros.filter((_, i) => i !== 0) };
  if (tema === 'usos') return { ...base, text: `${p.name}: ${p.uses.map(frase).join('. ')}.${fuente}`, chips: otros };
  if (tema === 'composicion') return { ...base, text: `${p.name} contiene ${minus(p.component)}, ${p.concentration}. Presentación: ${minus(p.form)}.${fuente}`, chips: otros.filter((_, i) => i !== 1) };
  if (tema === 'avisos') return { ...base, text: `${p.name}: ${p.precautions.slice(0, 3).map(frase).join('. ')}.${fuente}`, chips: otros.filter((_, i) => i !== 2) };
  return { ...base, text: `${p.name} es de ${p.lab}. ${frase(p.tagline)}. Presentación: ${minus(p.form)}.`, chips: otros };
}

function ayuda(c: AsistenteCtx): Respuesta {
  return {
    text: `Puedo decirle quién le visitó, qué productos le dejaron, cuándo es su próxima visita, cómo van sus solicitudes y sus mensajes, cambiar su estado y contarle lo que dice el empaque de cada producto. Solo pregunte, ${trato(c.me)}.`,
    chips: SUGERENCIAS,
  };
}

const has = (t: string, re: RegExp) => re.test(t);

/** quita la palabra de activación y los signos del principio */
export function limpiar(q: string) {
  return q
    .replace(/^[\s¿¡,.]*(hola|ola|oye|hey)[\s,]+(multi|multy|multilab|multi lab|mul ti)\b[\s,.!]*/i, '')
    .replace(/^[\s¿¡,.]*(multi|multy)[\s,]+/i, '')
    .trim();
}

/** ¿la frase empieza con «hola multi»? (el reconocimiento de voz a veces escribe «multy» u «hola, multi») */
export const esActivacion = (q: string) => /\b(hola|ola|oye|hey)[\s,]+(multi|multy|mul ti|multilab|multi lab)\b/i.test(normalize(q));

export function responder(pregunta: string, c: AsistenteCtx): Respuesta {
  const t = normalize(limpiar(pregunta)).replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return { text: `¿Sí, ${trato(c.me)}? Le escucho.`, chips: SUGERENCIAS };

  // cambiar el estado
  if (has(t, /\b(pon|ponme|poner|cambia|cambiar|marca|marcame|estoy|voy a estar|dejame)\b/) || has(t, /^(en consulta|libre|no disponible)$/)) {
    if (has(t, /no (estoy )?disponible|ausente|no molestar|ocupad/)) return cambiarEstado('ausente');
    if (has(t, /consulta|atendiendo|paciente/)) return cambiarEstado('consulta');
    if (has(t, /libre|disponible/)) return cambiarEstado('libre');
  }
  if (has(t, /mi estado|como estoy|que estado/)) return miEstado(c);

  // productos: por nombre
  const p = products.find((x) => t.includes(normalize(x.name)));
  if (p) {
    if (has(t, /dosis|dosific|como se (toma|usa|aplica|administra)|cuant[ao]s? (capsula|gota|veces)|modo de (uso|empleo)|tomar|posologia/)) return infoProducto(p, 'dosis');
    if (has(t, /para que|sirve|indicaci|uso[s]?\b|beneficio/)) return infoProducto(p, 'usos');
    if (has(t, /contien|composici|component|ingredient|formula|que (trae|tiene|lleva)|concentraci|presentaci/)) return infoProducto(p, 'composicion');
    if (has(t, /precauci|advertenc|contraindic|aviso|cuidado|efecto|riesgo/)) return infoProducto(p, 'avisos');
    return infoProducto(p, 'general');
  }

  // visitas
  if (has(t, /proxim|siguiente|cuando (viene|vuelve|vienen|me visitan|es mi)|visita de hoy|tengo visita|me visitan hoy|agenda/)) return proximaVisita(c);
  if (has(t, /dej(o|aron|ado)|entreg|muestras|material|me (dieron|trajeron|trajo)|recibi/)) return productosDejados(c);
  if (has(t, /cuantas (visitas|veces)|historial/)) return cuantasVisitas(c);
  if (has(t, /ultim\w* (persona|visita|visitador|vez)|quien (me |lo |la |nos )?(visito|vino|paso)|me visito|vino a verme|visito por ultima/)) return ultimaVisita(c);
  if (has(t, /mi visitador|quien es (mi|el) visitador|contact|representante/)) return miVisitador();
  if (has(t, /\bvisita/)) return ultimaVisita(c);

  if (has(t, /solicitud|pedido|pedi\b|tramite/)) return solicitudes(c);
  if (has(t, /mensaje|chat|escribi|me escrib/)) return mensajes(c);
  if (has(t, /notificaci|aviso|novedad|pendiente/)) return notificaciones(c);
  if (has(t, /devoluci|mal estado|danad|reposici/)) return devoluciones(c);
  if (has(t, /necesit|busqueda|busque/)) return necesidades(c);
  if (has(t, /catalogo|que productos (hay|tienes|tienen|manejan)|cuales productos|lista de productos|todos los productos/)) return catalogo();

  // charla
  if (has(t, /que (puedes|sabes) hacer|ayuda|ayudame|que te puedo preguntar|como funcionas|opciones/)) return ayuda(c);
  if (has(t, /quien eres|como te llamas|tu nombre|que eres/)) return { text: 'Soy Multi, su asistente en Multi LAB. Le ayudo a encontrar rápido lo que ya está en la aplicación.', chips: SUGERENCIAS };
  if (has(t, /^(muchas )?gracias|te agradezco|muy amable/)) return { text: `Con gusto, ${trato(c.me)}. Aquí estoy si necesita algo más.` };
  if (has(t, /adios|hasta luego|chao|nos vemos|eso es todo|nada mas/)) return { text: `Hasta luego, ${trato(c.me)}. Que tenga buena consulta.` };
  if (has(t, /^(hola|buenos dias|buenas tardes|buenas noches|buenas|que tal|como estas)\b/)) return { text: `Hola, ${trato(c.me)}. Soy Multi, su asistente. ¿En qué le puedo ayudar?`, chips: SUGERENCIAS };

  // palabras clave de producto («algo para el cabello», «vitamina d», «gotas»)
  const palabras = t.replace(/\b(algo|un|una|el|la|los|las|de|del|para|con|que|hay|tienes|tienen|producto|productos|busco|necesito|quiero|sobre|dime|hablame|cuentame|informacion|info)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (palabras) {
    const m = matchProducts([palabras]).filter((x) => x.score >= 2);
    if (m.length === 1) return infoProducto(m[0].product, 'general');
    if (m.length > 1) return { text: `Para «${palabras}» coinciden ${lista(m.map((x) => x.product.name))}. ¿De cuál le cuento?`, chips: m.slice(0, 3).map((x) => `Háblame de ${x.product.name}`) };
  }

  return {
    text: 'Ese dato no lo tengo. Puedo contarle de sus visitas, el material que le dejaron, sus solicitudes, sus mensajes o los productos.',
    chips: SUGERENCIAS,
    miss: true,
  };
}

/** clave corta y estable de un texto: con ella se busca su audio grabado */
export function claveVoz(text: string) {
  const s = normalize(text).replace(/[^a-z0-9]+/g, ' ').trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** el mismo texto, escrito como se lee en voz alta (unidades y signos) */
export function paraVoz(text: string) {
  const hora = (_: string, h: string, m: string) => {
    const H = Number(h);
    const h12 = H % 12 || 12;
    return `${h12}${m === '00' ? '' : ` y ${Number(m)}`} de la ${H < 12 ? 'mañana' : H < 19 ? 'tarde' : 'noche'}`;
  };
  return text
    .replace(/[«»]/g, '')
    // las marcas, escritas como se pronuncian (en mayúsculas la voz las deletrea o las lee en inglés)
    .replace(/CORAESSENS/g, 'Coraesens')
    .replace(/PANCREOGEN/g, 'Pancreogen')
    .replace(/TEARSOFT/g, 'Tirsoft')
    .replace(/DEFEROL/g, 'Deferol')
    .replace(/VITYBELL/g, 'Vitibel')
    .replace(/Multi LAB/g, 'Multilab')
    .replace(/\b(\d{1,2}):(\d{2})\b/g, hora)
    .replace(/\bla 0+(\d+)/g, 'la $1')
    .replace(/^(Coraesens|Pancreogen|Tirsoft|Deferol|Vitibel): /, '$1. ')
    .replace(/: /g, ', ')
    .replace(/\s·\s/g, ', ')
    .replace(/suero 25 \(OH\) D < 25 nmol\/L/g, 'suero 25 hidroxi vitamina D menor a 25 nanomoles por litro')
    .replace(/\((\d+)\)\s*/g, '')
    .replace(/ \(muestra\)/g, ', muestra')
    .replace(/ \(páncreas\)/g, ', páncreas,')
    .replace(/1 mL = 20 gotas/g, '1 mililitro equivale a 20 gotas')
    .replace(/mg\/mL/g, 'miligramos por mililitro')
    .replace(/(\d) mL\b/g, '$1 mililitros')
    .replace(/(\d) mg\b/g, '$1 miligramos')
    .replace(/(\d) mcg\b/g, '$1 microgramos')
    .replace(/(\d) g\b/g, '$1 gramos')
    .replace(/g\/Cápsula/g, 'gramos por cápsula')
    .replace(/U\.I\./g, 'unidades internacionales')
    .replace(/0\.810/g, '0,81')
    .replace(/L-5 MTHF/g, 'L 5 metiltetrahidrofolato')
    .replace(/piridoxal-5-fosfato/g, 'piridoxal 5 fosfato')
    .replace(/SOL-/g, 'solicitud ')
    .replace(/DEV-/g, 'devolución ')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}
