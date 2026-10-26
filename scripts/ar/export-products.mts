// Exporta los datos de los productos a JSON para los scripts de Python.
// - scripts/ar/products.json: productos ficticios (modelos de AR y tarjetas impresas)
// - scripts/fichas/products.json: todos, con los textos de la ficha en PDF (incluye CORAESSENS)
// Uso: node --experimental-strip-types scripts/ar/export-products.mts
import { mkdirSync, writeFileSync } from 'node:fs';
import { CORAESSENS_INFO, vitrinaCards } from '../../src/data/coraessens-info.ts';
import { labs, products } from '../../src/data/mock.ts';

// los productos reales (con fotos) tienen su propio modelo: scripts/coraessens/modelo.py
const data = products.filter((p) => !p.real).map(({ id, name, lab, category, form, howTo, precautions, hue }) => ({ id, name, lab, category, form, howTo, precautions, hue }));
writeFileSync(new URL('./products.json', import.meta.url), JSON.stringify(data, null, 2));

const fichas = products.map((p) => ({
  id: p.id,
  name: p.name,
  lab: p.lab,
  labFull: labs.find((l) => l.name === p.lab)?.full ?? p.lab,
  category: p.category,
  form: p.form,
  component: p.component,
  concentration: p.concentration,
  tagline: p.tagline,
  description: p.description,
  uses: p.uses,
  howTo: p.howTo,
  precautions: p.precautions,
  hue: p.hue,
  specs: p.specs ?? null,
  notes: p.notes ?? null,
  real: p.real ?? null,
  sizeCm: p.sizeCm ?? null,
  ...(p.id === 'cor' ? { info: { ...CORAESSENS_INFO.names.real, formula: CORAESSENS_INFO.formula, badges: CORAESSENS_INFO.badges, sample: CORAESSENS_INFO.sample, cards: vitrinaCards('real') } } : {}),
}));
mkdirSync(new URL('../fichas/', import.meta.url), { recursive: true });
writeFileSync(new URL('../fichas/products.json', import.meta.url), JSON.stringify(fichas, null, 2));
console.log(`${data.length} productos para AR · ${fichas.length} fichas`);
