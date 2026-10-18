// Completa la versión web exportada para que se pueda agregar a la pantalla de inicio del celular
// (ícono, nombre y pantalla completa) y para que GitHub Pages abra cualquier ruta de la app.
// Uso: node scripts/web/pwa.mjs <carpeta exportada>   (respeta WEB_BASE_URL, por ejemplo /multi-lab)
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist-web';
const base = (process.env.WEB_BASE_URL ?? '').replace(/\/$/, '');
const color = '#FFFFFF';

const manifest = {
  name: 'Multi LAB',
  short_name: 'Multi LAB',
  lang: 'es',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: color,
  theme_color: color,
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png' },
  ],
};
writeFileSync(join(dir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

const tags = [
  `<link rel="manifest" href="${base}/manifest.webmanifest" />`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />`,
  `<meta name="theme-color" content="${color}" />`,
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Multi LAB" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="description" content="Multi LAB: catálogo multimedia interactivo para la visita médica (prototipo de titulación con datos ficticios)." />',
].join('\n    ');

const file = join(dir, 'index.html');
let html = readFileSync(file, 'utf8');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `    ${tags}\n  </head>`);
html = html.replace('<html lang="en">', '<html lang="es">');
writeFileSync(file, html);
// GitHub Pages responde 404.html en las rutas que no existen como archivo: así abre la app igual
copyFileSync(file, join(dir, '404.html'));
// AR con tarjeta (public/ar-tarjeta): los modelos se sirven desde el mismo sitio
const modelos = join(dir, 'ar-tarjeta', 'modelos');
mkdirSync(modelos, { recursive: true });
for (const f of readdirSync('ar/models').filter((f) => f.endsWith('.glb'))) copyFileSync(join('ar/models', f), join(modelos, f));
console.log(`Versión web lista en ${dir} (base: ${base || '/'})`);
