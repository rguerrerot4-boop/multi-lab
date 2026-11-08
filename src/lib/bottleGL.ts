// Frasco en 3D real (WebGL con three.js) para la versión web: el mismo modelo animado de la realidad
// aumentada (ar/models/pan.glb), con la misma cámara y las mismas luces con que se renderizaron los cuadros
// (scripts/pancreogen/cuadros/render.html). Gira a cualquier ángulo sin saltos ni imagen doble y se ve
// nítido en cualquier pantalla. Si WebGL o el modelo fallan, Bottle360 sigue con los cuadros.
// Este módulo se carga solo en la web y bajo demanda (import dinámico).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface BottleCam {
  fov: number; // radianes (vertical)
  dist: number;
  elev: number; // radianes
  ty: number;
}

/** margen alrededor de la caja del cuadro de giro (en fracciones) para la tapa y las cápsulas al abrir */
export interface GLPad {
  l: number;
  r: number;
  t: number;
  b: number;
}

// tiempos del modelo animado (scripts/pancreogen/modelo.py): cerrado y con las 12 cápsulas afuera
const T_CLOSED = 1.9;
const T_OPEN = 5.55;

const cache = new Map<string, Promise<GLTF>>();
function loadModel(url: string) {
  let p = cache.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** empieza a descargar el modelo antes de abrir la ficha (por ejemplo, al ver el banner) */
export function preloadBottle(url: string) {
  void loadModel(url).catch(() => undefined);
}

export interface GLBottle {
  /** dibuja el frasco girado `frame` cuadros (60 = una vuelta) y abierto `open` (0–1) */
  render(frame: number, open: number): void;
  /** tamaño en píxeles CSS de la caja del cuadro de giro (sin margen) */
  resize(boxW: number, boxH: number): void;
  dispose(): void;
}

export async function createBottleGL(canvas: HTMLCanvasElement, url: string, cam: BottleCam, frames: number, boxW: number, boxH: number, GL_PAD: GLPad): Promise<GLBottle> {
  const gltf = await loadModel(url);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  pm.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-1.2, 1.6, 2.2);
  const rim = new THREE.DirectionalLight(0xdff6ff, 0.9);
  rim.position.set(2, 0.8, -1.5);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.15));

  // cada instancia usa su copia de la escena (las geometrías y texturas se comparten en el mismo contexto)
  const root = gltf.scene.clone(true);
  scene.add(root);
  ['Nombre', 'Aro'].forEach((n) => {
    const o = root.getObjectByName(n);
    if (o) o.visible = false;
  });
  const frasco = root.getObjectByName('Frasco');
  const mixer = new THREE.AnimationMixer(root);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  // texturas nítidas aunque el frasco se vea inclinado
  const aniso = renderer.capabilities.getMaxAnisotropy();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.map) m.map.anisotropy = Math.min(8, aniso);
  });

  const camera = new THREE.PerspectiveCamera((cam.fov * 180) / Math.PI, 1, 0.01, 10);
  const target = new THREE.Vector3(0, cam.ty, 0);
  camera.position.set(0, cam.ty + Math.sin(cam.elev) * cam.dist, Math.cos(cam.elev) * cam.dist);
  camera.lookAt(target);

  let W = 0;
  let H = 0;
  const setSize = (bw: number, bh: number) => {
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const cw = bw * (1 + GL_PAD.l + GL_PAD.r);
    const ch = bh * (1 + GL_PAD.t + GL_PAD.b);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cw, ch, false);
    // la caja del cuadro de giro es la «vista completa»; el lienzo la amplía con el margen
    camera.aspect = bw / bh;
    camera.setViewOffset(bw, bh, -GL_PAD.l * bw, -GL_PAD.t * bh, cw, ch);
    camera.updateProjectionMatrix();
    W = bw;
    H = bh;
  };
  setSize(boxW, boxH);

  let lastF = NaN;
  let lastO = NaN;
  let lastW = 0;
  return {
    render(frame, open) {
      if (frame === lastF && open === lastO && W === lastW) return;
      lastF = frame;
      lastO = open;
      lastW = W;
      root.rotation.y = (frame * 2 * Math.PI) / frames;
      mixer.setTime(T_CLOSED + Math.max(0, Math.min(1, open)) * (T_OPEN - T_CLOSED));
      if (frasco) {
        // sin el giro ni la flotación de la animación de AR: la etiqueta queda de frente
        frasco.quaternion.set(0, 0, 0, 1);
        frasco.position.y = 0;
      }
      renderer.render(scene, camera);
    },
    resize(bw, bh) {
      if (bw !== W || bh !== H) {
        setSize(bw, bh);
        lastF = NaN;
      }
    },
    dispose() {
      mixer.stopAllAction();
      env.dispose();
      renderer.dispose();
      // libera el contexto WebGL al salir o al cambiar de modo (los navegadores permiten pocos a la vez)
      renderer.forceContextLoss();
    },
  };
}
