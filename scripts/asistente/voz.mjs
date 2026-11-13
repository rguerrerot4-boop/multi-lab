// Escribe src/data/asistente-voz.ts con los audios de «Multi» (scripts/asistente/voz.json: clave, texto y URL del audio).
// Los audios se grabaron en Higgsfield (Text to Speech V2 con el motor ElevenLabs, voz «Gia»: español latino, cálida)
// con el texto `voz` de cada frase
// (scripts/asistente/textos.mts) y se reproducen desde el CDN de Higgsfield.
// Uso: node scripts/asistente/voz.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const list = JSON.parse(readFileSync(new URL('./voz.json', import.meta.url), 'utf8'));
const base = list[0].url.slice(0, list[0].url.lastIndexOf('/') + 1);
const lines = list.map((x) => `  '${x.key}': B + '${x.url.slice(base.length)}', // ${x.text.slice(0, 70).replace(/\s+/g, ' ')}${x.text.length > 70 ? '…' : ''}`);
writeFileSync(
  new URL('../../src/data/asistente-voz.ts', import.meta.url),
  `// Audios de «Multi» grabados con Higgsfield (ElevenLabs, voz «Gia»). Archivo generado: scripts/asistente/voz.mjs.
// La clave es claveVoz(texto) de src/lib/asistente.ts. Si una respuesta no está aquí, habla la voz del dispositivo.
const B = '${base}';

export const VOZ: Record<string, string> = {
${lines.join('\n')}
};
`,
);
console.log(`${list.length} audios`);
