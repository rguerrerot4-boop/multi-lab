// Cuadros del catálogo 3D de PANCREOGEN (assets/pancreogen): giro (60 cuadros, 6° cada uno), apertura
// (40 cuadros: la tapa se desenrosca y salen las cápsulas) y la miniatura de frente, real y ficticio.
// Necesita three@0.160 y playwright (npm i three@0.160.0 playwright en una carpeta aparte) y los modelos de
// modelo.py: pan.glb / pan-f.glb (animados, ar/models) y pan-estatico.glb / pan-f-estatico.glb.
// Las cámaras coinciden con las constantes de src/components/Bottle360.tsx (CAM y OPEN).
// Uso: node cuadros.cjs <carpeta con los glb> <salida png>   (luego: python3 webp.py <salida png>)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [glbDir, out] = process.argv.slice(2);
const threeDir = path.dirname(path.dirname(require.resolve('three')));
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const p = u.startsWith('/three/') ? path.join(threeDir, u.slice(7)) : u.startsWith('/glb/') ? path.join(glbDir, u.slice(5)) : path.join(__dirname, u);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(r);
}).listen(8779);
const OPEN_T = [1.9, 5.55]; // de la tapa cerrada a las 12 cápsulas afuera (ver modelo.py)
const jobs = [];
for (const [m, pre] of [['', ''], ['-f', '-f']]) {
  jobs.push({ q: `f=pan${m}-estatico`, w: 420, h: 1000, list: Array.from({ length: 60 }, (_, i) => [`giro${pre}-${String(i).padStart(2, '0')}`, i * 6]) });
  jobs.push({ q: `f=pan${m}&w=760&h=1000&dist=0.6606&ty=0.0904&hide=Nombre,Aro&fix=Frasco`, w: 760, h: 1000, list: Array.from({ length: 40 }, (_, i) => [`abrir${pre}-${String(i).padStart(2, '0')}`, 0, OPEN_T[0] + ((OPEN_T[1] - OPEN_T[0]) * i) / 39]) });
  jobs.push({ q: `f=pan${m}-estatico&w=840&h=2000&pr=1`, w: 840, h: 2000, list: [[m ? 'ficticio-frente' : 'frente', 0]] });
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  fs.mkdirSync(out, { recursive: true });
  for (const j of jobs) {
    const p = await b.newPage({ viewport: { width: j.w, height: j.h } });
    p.on('pageerror', (e) => console.log('ERR', e));
    await p.goto(`http://localhost:8779/render.html?${j.q}`);
    await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
    for (const [name, deg, t] of j.list) {
      await p.evaluate(([d, tt]) => window.frame(d, tt === null ? undefined : tt), [deg, t ?? null]);
      await p.locator('canvas').screenshot({ path: `${out}/${name}.png`, omitBackground: true });
    }
    await p.close();
    console.log(j.q, j.list.length);
  }
  await b.close();
  srv.close();
})();
