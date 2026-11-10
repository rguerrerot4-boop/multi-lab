// Caja de TEARSOFT en 3D real (WebGL con three.js) para la versión web: las seis caras son las fotos
// enderezadas del empaque (scripts/tearsoft/texturas.py). La caja se puede desplegar en su troquel (las caras
// giran sobre sus pliegues hasta quedar planas) y volver a armarse; gotas de lágrima giran a su alrededor.
// Se arrastra para girarla (con inercia) y, quieta, gira sola despacio. Solo se carga en la web (import dinámico).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type Face = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom';

export interface BoxGL {
  /** 1 = caja armada, 0 = troquel plano */
  setFold(target: number, instant?: boolean): void;
  /** activa o pausa el dibujo (página fuera de pantalla) */
  setActive(on: boolean): void;
  /** resalta una cara (o ninguna) */
  setHighlight(face: Face | null): void;
  /** cambia las fotos (nombre real / ficticio) */
  setTextures(urls: Record<Face, string>): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

export interface BoxGLOptions {
  urls: Record<Face, string>;
  /** medidas relativas (ancho, alto, fondo) */
  dims: { w: number; h: number; d: number };
  drops?: boolean;
  reduce?: boolean;
  /** encuadre: 1 = la caja llena el alto disponible */
  zoom?: number;
  onReady?: () => void;
}

const CARDBOARD = 0xece6da;
const DROP = 0x8ad1fd;

function dropGeometry() {
  // gota con la punta hacia arriba: r = sen t · sen(t/2)
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = (Math.PI * i) / 28;
    pts.push(new THREE.Vector2(Math.sin(t) * Math.sin(t / 2) * 0.62, Math.cos(t) * 0.8));
  }
  return new THREE.LatheGeometry(pts.reverse(), 32);
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(30, 29, 74, 0.42)');
  r.addColorStop(1, 'rgba(30, 29, 74, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createBoxGL(canvas: HTMLCanvasElement, opts: BoxGLOptions): BoxGL {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  pm.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-1.5, 2.2, 2.4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  // medidas: el alto de la caja vale 1
  const H = 1;
  const W = (opts.dims.w / opts.dims.h) * H;
  const D = (opts.dims.d / opts.dims.h) * H;

  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mats: Record<Face, THREE.MeshStandardMaterial> = {} as never;
  const faces: Face[] = ['front', 'right', 'back', 'left', 'top', 'bottom'];
  faces.forEach((f) => (mats[f] = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, emissive: 0x000000 })));
  let pending = 0;
  let ready = false;
  const done = () => {
    pending--;
    dirty = true;
    if (!pending && !ready) {
      ready = true;
      opts.onReady?.();
    }
  };
  const loadAll = (urls: Record<Face, string>) => {
    // cada foto se carga una vez (el reverso usa la del frente; los costados y las tapas se repiten)
    const unique = [...new Set(faces.map((f) => urls[f]))];
    unique.forEach((u) => {
      pending++;
      const t = loader.load(u, done, undefined, done);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      faces
        .filter((f) => urls[f] === u)
        .forEach((f) => {
          const old = mats[f].map;
          mats[f].map = t;
          mats[f].needsUpdate = true;
          if (old && !faces.some((g) => mats[g].map === old)) old.dispose();
        });
    });
  };
  loadAll(opts.urls);

  const inner = new THREE.MeshStandardMaterial({ color: CARDBOARD, roughness: 0.9, side: THREE.BackSide });
  const panel = (face: Face, w: number, h: number, dx: number, dy: number) => {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(dx, dy, 0);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(g, mats[face]), new THREE.Mesh(g, inner));
    return grp;
  };

  // troquel: el frente al centro; los costados y las tapas giran sobre sus pliegues; el reverso cuelga del costado derecho
  const net = new THREE.Group();
  net.add(panel('front', W, H, 0, 0));
  const right = new THREE.Group();
  right.position.set(W / 2, 0, 0);
  right.add(panel('right', D, H, D / 2, 0));
  const back = new THREE.Group();
  back.position.set(D, 0, 0);
  back.add(panel('back', W, H, W / 2, 0));
  right.add(back);
  const left = new THREE.Group();
  left.position.set(-W / 2, 0, 0);
  left.add(panel('left', D, H, -D / 2, 0));
  const top = new THREE.Group();
  top.position.set(0, H / 2, 0);
  top.add(panel('top', W, D, 0, D / 2));
  const bottom = new THREE.Group();
  bottom.position.set(0, -H / 2, 0);
  bottom.add(panel('bottom', W, D, 0, -D / 2));
  net.add(right, left, top, bottom);

  const spin = new THREE.Group(); // giro del usuario
  spin.add(net);
  const holder = new THREE.Group(); // flotación
  holder.add(spin);
  scene.add(holder);

  // sombra en el piso
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -H / 2 - 0.18;
  scene.add(shadow);

  // gotas alrededor
  const drops: THREE.Mesh[] = [];
  if (opts.drops) {
    const dg = dropGeometry();
    const dm = new THREE.MeshPhysicalMaterial({ color: DROP, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(dg, dm);
      m.scale.setScalar(0.07 + (i % 3) * 0.018);
      scene.add(m);
      drops.push(m);
    }
  }

  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  let vw = 1;
  let vh = 1;

  // estado
  let fold = 1;
  let foldTarget = 1;
  let yaw = -0.55;
  let pitch = 0.18;
  let vYaw = 0;
  let vPitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let idleAt = 0;
  let active = true;
  let dirty = true;
  let raf = 0;
  let prev = performance.now();
  const start = prev;
  let highlight: Face | null = null;

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = performance.now();
    vYaw = vPitch = 0;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const now = performance.now();
    const dt = Math.max(8, now - lastT);
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const k = 4.2 / Math.max(240, vw);
    yaw += dx * k;
    pitch = Math.max(-0.9, Math.min(0.9, pitch + dy * k * 0.7));
    vYaw = ((dx * k) / dt) * 1000;
    vPitch = ((dy * k * 0.7) / dt) * 1000;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = now;
    dirty = true;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    idleAt = performance.now();
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  // solo el giro de lado: el desplazamiento vertical de la página sigue funcionando
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';

  const ease = (x: number) => x * x * (3 - 2 * x);

  const frame = (now: number) => {
    raf = 0;
    if (!active) return;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const t = (now - start) / 1000;

    // despliegue (amortiguado, sin rebote)
    if (Math.abs(foldTarget - fold) > 0.0005) {
      fold += (foldTarget - fold) * Math.min(1, dt * 5.2);
      dirty = true;
    } else fold = foldTarget;

    // inercia y giro solo
    if (!dragging) {
      if (Math.abs(vYaw) > 0.002 || Math.abs(vPitch) > 0.002) {
        yaw += vYaw * dt;
        pitch = Math.max(-0.9, Math.min(0.9, pitch + vPitch * dt));
        const damp = Math.exp(-dt * 3.2);
        vYaw *= damp;
        vPitch *= damp;
        dirty = true;
      } else if (!opts.reduce && now - idleAt > 1600 && fold > 0.98) {
        yaw += dt * 0.32;
        pitch += (0.18 - pitch) * Math.min(1, dt * 1.5);
        dirty = true;
      }
    }

    const f = ease(fold);
    const a = (Math.PI / 2) * f;
    right.rotation.y = a;
    back.rotation.y = a;
    left.rotation.y = -a;
    top.rotation.x = -a;
    bottom.rotation.x = a;
    // centro: el de la caja armada o el del troquel
    net.position.set(-(W / 2) * (1 - f), 0, (D / 2) * f);
    // al desplegarse, el troquel queda de frente a la cámara
    const u = 1 - f;
    spin.rotation.set(pitch * f, yaw * f, 0);
    const bob = opts.reduce ? 0 : Math.sin(t * 1.4) * 0.025 * f;
    holder.position.y = bob;
    (shadow.material as THREE.MeshBasicMaterial).opacity = f;
    shadow.scale.setScalar(1 - bob * 1.5);

    drops.forEach((m, i) => {
      const k = i / drops.length;
      const ang = k * Math.PI * 2 - t * 0.5;
      const r = 0.78 + 0.06 * Math.sin(t * 1.3 + i);
      m.position.set(Math.cos(ang) * r, -0.42 + ((i * 4) % drops.length) / (drops.length - 1) * 0.95 + Math.sin(t * 2 + i * 1.7) * 0.05, Math.sin(ang) * r * 0.75);
      m.rotation.z = Math.sin(t * 1.6 + i) * 0.25;
      m.visible = f > 0.6;
      const s = (0.07 + (i % 3) * 0.018) * Math.min(1, (f - 0.6) / 0.4);
      m.scale.setScalar(Math.max(0.0001, s));
    });
    if (drops.length) dirty = true;

    // encuadre: la caja (alto 1) o el troquel (≈ 2·ancho + 2·fondo)
    const zoom = opts.zoom ?? 1;
    const needH = (1.55 * f + (H + 2 * D) * 1.12 * u) / zoom;
    const needW = (1.25 * f + (2 * W + 2 * D) * 1.1 * u) / zoom;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distH = needH / 2 / Math.tan(fov / 2);
    const distW = needW / 2 / Math.tan(fov / 2) / camera.aspect;
    const dist = Math.max(distH, distW);
    camera.position.set(0, 0.18 * f, dist);
    camera.lookAt(0, 0, 0);

    // cara resaltada: las demás se oscurecen
    faces.forEach((g) => {
      mats[g].color.setHex(!highlight || highlight === g ? 0xffffff : 0x8f97ab);
      mats[g].emissive.setHex(highlight === g ? 0x0d1a33 : 0x000000);
    });

    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
    raf = requestAnimationFrame(frame);
  };

  const resize = (w: number, h: number) => {
    vw = w;
    vh = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    dirty = true;
  };
  resize(canvas.clientWidth || 300, canvas.clientHeight || 300);
  raf = requestAnimationFrame(frame);
  void vh;

  return {
    setFold(target, instant) {
      // el giro acumulado se lleva a una sola vuelta: al desplegarse no da varias vueltas de golpe
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      vYaw = vPitch = 0;
      foldTarget = Math.max(0, Math.min(1, target));
      if (instant) fold = foldTarget;
      dirty = true;
    },
    setActive(on) {
      active = on;
      if (on && !raf) {
        prev = performance.now();
        dirty = true;
        raf = requestAnimationFrame(frame);
      }
    },
    setHighlight(face) {
      highlight = face;
      dirty = true;
    },
    setTextures(urls) {
      loadAll(urls);
      dirty = true;
    },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      active = false;
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
      });
      faces.forEach((f) => {
        mats[f].map?.dispose();
        mats[f].dispose();
      });
      env.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
