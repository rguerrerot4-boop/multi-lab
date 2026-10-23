// Compila los paneles de public/ar-tarjeta/objetivos en el archivo de objetivos de MindAR (tarjetas.mind).
// El compilador de MindAR funciona en el navegador, así que se ejecuta en Chromium con Playwright.
//
// Uso (después de python3 scripts/ar/build_cards.py):
//   npm pack mind-ar@1.2.5 && tar xzf mind-ar-1.2.5.tgz        (deja la carpeta package/ con dist/)
//   NODE_PATH=<carpeta con playwright> node scripts/ar/compile_cards.cjs <ruta a package/dist de mind-ar>
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const CARDS = path.join(ROOT, 'public', 'ar-tarjeta', 'objetivos');
const OUT = path.join(ROOT, 'public', 'ar-tarjeta', 'tarjetas.mind');
const DIST = path.resolve(process.argv[2] || 'package/dist');
// mismo orden que los productos: el índice del objetivo es la posición en esta lista
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'ar-tarjeta', 'productos.json'), 'utf8')).map((p) => p.id);

const types = { '.js': 'text/javascript', '.png': 'image/png', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = null;
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><meta charset="utf-8"><title>Compilar</title>'); }
  if (url.startsWith('/mindar/')) file = path.join(DIST, url.slice(8));
  if (url.startsWith('/tarjetas/')) file = path.join(CARDS, url.slice(10));
  if (!file || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((r) => server.listen(8123, r));
  // CHROMIUM_PATH permite usar un Chromium ya instalado en lugar del que descarga Playwright
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const page = await browser.newPage();
  page.on('crash', () => console.log('  la pestaña se cerró (memoria)'));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  consola:', m.text().slice(0, 120)); });
  await page.goto('http://localhost:8123/');
  const b64 = await page.evaluate(async (ids) => {
    const { Compiler } = await import('/mindar/mindar-image.prod.js');
    const images = await Promise.all(ids.map((id) => new Promise((ok, fail) => {
      const img = new Image();
      // como máximo 900 px de ancho: el archivo pesa menos y la cámara lo reconoce igual
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.min(img.width, 900);
        c.height = Math.round((img.height * c.width) / img.width);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c);
      };
      img.onerror = fail;
      img.src = `/tarjetas/${id}.png`;
    })));
    const compiler = new Compiler();
    await compiler.compileImageTargets(images, () => {});
    const data = await compiler.exportData();
    let s = '';
    for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return btoa(s);
  }, IDS);
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`${IDS.length} objetivos compilados en ${path.relative(ROOT, OUT)} (${IDS.join(', ')})`);
  await browser.close();
  server.close();
})();
