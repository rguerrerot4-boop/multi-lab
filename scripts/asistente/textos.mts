// Lista las frases que dice «Multi» con los datos de la cuenta demo, para grabarlas con la voz de Higgsfield.
// Cada frase lleva su clave (claveVoz): la app busca el audio por esa clave en src/data/asistente-voz.ts
// y, si una respuesta no tiene audio grabado (datos que cambiaron en la sesión), usa la voz del dispositivo.
// Uso: node --experimental-strip-types scripts/asistente/textos.mts > scripts/asistente/textos.json
import { chats, DEMO_USER, initialDoctorStatus, initialNeeds, initialReturns, notices, personById, products, requests, visits } from '../../src/data/mock.ts';
import { claveVoz, infoProducto, paraVoz, responder, type AsistenteCtx } from '../../src/lib/asistente.ts';

const me = personById(DEMO_USER.medico);
const ctx: AsistenteCtx = {
  me,
  visits: visits.filter((v) => v.doctorId === me.id),
  requests: requests.filter((r) => r.doctorId === me.id),
  chats: chats.filter((c) => c.members.includes(me.id)),
  notices: notices.filter((n) => n.forRole === 'medico' || n.forRole === 'all'),
  needs: initialNeeds.filter((n) => n.doctorId === me.id),
  returns: initialReturns.filter((r) => r.doctorId === me.id),
  status: initialDoctorStatus[me.id],
};

const preguntas = [
  '', 'hola', 'qué puedes hacer', 'quién eres', 'gracias', 'adiós', 'cuál es la capital de Francia',
  'quién fue la última persona en visitarme', 'qué productos me dejaron', 'cuándo es mi próxima visita', 'cuántas visitas he tenido',
  'cómo van mis solicitudes', 'tengo mensajes', 'tengo notificaciones', 'cuál es mi estado', 'ponme en consulta', 'ponme libre', 'ponme no disponible',
  'tengo devoluciones', 'mis búsquedas', 'quién es mi visitador', 'qué productos hay',
  'algo para el cabello', 'gotas para los ojos', 'vitamina d', 'magnesio', 'suplemento',
];
const textos = new Map<string, string>();
const add = (t: string) => textos.set(claveVoz(t), t);
preguntas.forEach((q) => add(responder(q, ctx).text));
products.forEach((p) => (['general', 'dosis', 'usos', 'composicion', 'avisos'] as const).forEach((tema) => add(infoProducto(p, tema).text)));
// estados distintos al inicial
(['libre', 'consulta', 'ausente'] as const).forEach((state) => add(responder('cuál es mi estado', { ...ctx, status: { state, at: 0 } }).text));
console.log(JSON.stringify([...textos].map(([key, text]) => ({ key, text, voz: paraVoz(text) })), null, 1));
