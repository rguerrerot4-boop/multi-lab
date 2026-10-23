// Exporta los datos de los productos ficticios a JSON para generar los modelos de AR.
// Uso: node --experimental-strip-types scripts/ar/export-products.mts
import { writeFileSync } from 'node:fs';
import { products } from '../../src/data/mock.ts';

// los productos reales (con fotos) tienen su propio modelo: scripts/coraessens/modelo.py
const data = products.filter((p) => !p.real).map(({ id, name, lab, category, form, howTo, precautions, hue }) => ({ id, name, lab, category, form, howTo, precautions, hue }));
writeFileSync(new URL('./products.json', import.meta.url), JSON.stringify(data, null, 2));
console.log(`${data.length} productos exportados`);
