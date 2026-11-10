// Caja de un empaque fotografiado (TEARSOFT y DEFEROL) en 3D real (WebGL con three.js) para la versión web: las
// seis caras son las fotos enderezadas del empaque (scripts/tearsoft/texturas.py, scripts/deferol/texturas.py). La
// caja se puede desplegar en su troquel (las caras giran sobre sus pliegues hasta quedar planas) y volver a armarse;
// alrededor giran gotas (TEARSOFT) o cápsulas blandas ilustrativas (DEFEROL). Se arrastra para girarla (con inercia),
// puede girar sola hasta mostrar una cara y, quieta, gira despacio. Solo se carga en la web (import dinámico).
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
  /** gira la caja hasta dejar esa cara de frente (null: vuelve a girar sola) */
  faceTo(face: Face | null): void;
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
  /** cápsulas blandas alrededor (en vez de gotas) */
  capsules?: boolean;
  /** giro libre en cualquier dirección (como tomar la caja con la mano); sin esto, con el dedo solo gira de lado */
  free?: boolean;
  reduce?: boolean;
  /** encuadre: 1 = la caja llena el alto disponible */
  zoom?: number;
  onReady?: () => void;
}

const CARDBOARD = 0xece6da;
const DROP = 0x8ad1fd;
const CAPSULE = 0xf2b33d;

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
  shadow.scale.x = Math.max(1, W * 0.9);
  scene.add(shadow);

  // gotas alrededor
  const drops: THREE.Mesh[] = [];
  if (opts.drops || opts.capsules) {
    // cápsula blanda: esfera estirada (la escala de cada una la estira en x)
    const dg = opts.capsules ? new THREE.SphereGeometry(0.5, 32, 20) : dropGeometry();
    const dm = opts.capsules
      ? new THREE.MeshPhysicalMaterial({ color: CAPSULE, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 })
      : new THREE.MeshPhysicalMaterial({ color: DROP, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 });
    const n = opts.capsules ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(dg, dm);
      scene.add(m);
      drops.push(m);
    }
  }
  // radio de la órbita: alrededor de la caja (la de DEFEROL es ancha)
  const orbit = Math.max(0.78, Math.hypot(W, D) / 2 + 0.16);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  let vw = 1;
  let vh = 1;

  // estado
  let fold = 1;
  let foldTarget = 1;
  let yaw = -0.55;
  let pitch = 0.18;
  // el giro dibujado (yaw, pitch) sigue con suavidad al giro buscado (gYaw, gPitch): el arrastre, la inercia, el
  // giro solo y el giro hacia una cara solo mueven el buscado, así no hay saltos entre un evento y otro
  let gYaw = yaw;
  let gPitch = pitch;
  let vYaw = 0;
  let vPitch = 0;
  let dragging = false;
  let touch = false;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let lastMove = 0;
  // con el dedo: de lado gira la caja; de arriba abajo desplaza la página (se decide al empezar a mover)
  let lock: 'h' | 'v' | null = null;
  let tx0 = 0;
  let ty0 = 0;
  let idleAt = 0;
  let active = true;
  let dirty = true;
  let raf = 0;
  let prev = performance.now();
  const start = prev;
  let highlight: Face | null = null;
  // giro automático hacia una cara
  let aim: { yaw: number; pitch: number } | null = null;

  // giro libre: la orientación es un cuaternión (dibujada q, buscada gQ) y la velocidad, un giro por segundo
  // alrededor de los ejes de la pantalla (x: arriba-abajo, y: de lado)
  const free = !!opts.free;
  const eulerQ = (yw: number, pt: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pt, yw, 0, 'XYZ'));
  const q = eulerQ(yaw, pitch);
  const gQ = q.clone();
  let aimQ: THREE.Quaternion | null = null;
  let wx = 0;
  let wy = 0;
  let pxRad = 0.01; // radianes por píxel de arrastre (se calcula para que la caja siga al dedo)
  const AX = new THREE.Vector3();
  const dq = new THREE.Quaternion();
  const turn = (ax: number, ay: number, ang: number) => {
    if (ang < 1e-6) return;
    AX.set(ax, ay, 0).normalize();
    dq.setFromAxisAngle(AX, ang);
    gQ.premultiply(dq);
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    touch = e.pointerType === 'touch';
    aim = null;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = lastMove = performance.now();
    vYaw = vPitch = 0;
    gYaw = yaw;
    gPitch = pitch;
    aimQ = null;
    wx = wy = 0;
    if (!touch) canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    if (free) {
      // la caja gira en la dirección del arrastre, al ritmo del dedo
      const now = performance.now();
      const dt = Math.max(6, now - lastT);
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      turn(dy, dx, Math.hypot(dx, dy) * pxRad);
      wx = wx * 0.5 + ((dy * pxRad) / dt) * 1000 * 0.5;
      wy = wy * 0.5 + ((dx * pxRad) / dt) * 1000 * 0.5;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = lastMove = now;
      dirty = true;
      return;
    }
    // con el dedo, hasta saber la dirección no se gira; si es vertical, la página se desplaza
    if (touch && lock !== 'h') {
      if (lock === 'v') dragging = false;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    const now = performance.now();
    const dt = Math.max(6, now - lastT);
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const k = 4.4 / Math.max(260, vw);
    gYaw += dx * k;
    // con el mouse también se inclina; con el dedo solo gira de lado (lo vertical es de la página)
    if (!touch) gPitch = Math.max(-0.9, Math.min(1.3, gPitch + dy * k * 0.6));
    // velocidad suavizada: un evento suelto no lanza la caja
    vYaw = vYaw * 0.55 + (((dx * k) / dt) * 1000) * 0.45;
    vPitch = touch ? 0 : vPitch * 0.55 + (((dy * k * 0.6) / dt) * 1000) * 0.45;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = lastMove = now;
    dirty = true;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    // si el dedo se quedó quieto antes de soltar, no hay inercia
    if (performance.now() - lastMove > 70) vYaw = vPitch = wx = wy = 0;
    vYaw = Math.max(-9, Math.min(9, vYaw));
    const w = Math.hypot(wx, wy);
    if (w > 9) {
      wx *= 9 / w;
      wy *= 9 / w;
    }
    idleAt = performance.now();
    canvas.style.cursor = 'grab';
  };
  const onTouchStart = (e: TouchEvent) => {
    lock = null;
    tx0 = e.touches[0]?.clientX ?? 0;
    ty0 = e.touches[0]?.clientY ?? 0;
  };
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t || e.touches.length > 1) return;
    // giro libre: todo el arrastre sobre la caja es para girarla
    if (free) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (!lock) {
      const dx = Math.abs(t.clientX - tx0);
      const dy = Math.abs(t.clientY - ty0);
      if (dx + dy < 6) return;
      lock = dx > dy * 0.75 ? 'h' : 'v';
      if (lock === 'h') {
        // el giro empieza desde aquí, sin el tramo que se usó para decidir
        lastX = t.clientX;
        lastT = performance.now();
      }
    }
    // de lado: la página no se desplaza ni cancela el gesto
    if (lock === 'h' && e.cancelable) e.preventDefault();
  };
  const onTouchEnd = () => {
    lock = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);
  // el navegador solo se encarga del desplazamiento vertical; lo de lado lo decide onTouchMove
  // (con giro libre, nada: la página se desplaza tocando fuera de la caja)
  canvas.style.touchAction = free ? 'none' : 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.style.userSelect = 'none';
  (canvas.style as unknown as Record<string, string>).webkitUserSelect = 'none';
  (canvas.style as unknown as Record<string, string>).webkitTapHighlightColor = 'transparent';

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

    // inercia, giro solo y giro hacia una cara: mueven el giro buscado
    if (free) {
      if (!dragging) {
        if (aimQ) gQ.copy(aimQ);
        else if (Math.hypot(wx, wy) > 0.02) {
          turn(wx, wy, Math.hypot(wx, wy) * dt);
          const damp = Math.exp(-dt * 3.2);
          wx *= damp;
          wy *= damp;
        } else if (!opts.reduce && now - idleAt > 1800 && fold > 0.98) {
          // quieta: se endereza despacio y gira sola sobre su eje vertical
          const fr = new THREE.Vector3(0, 0, 1).applyQuaternion(gQ);
          const yw = Math.atan2(fr.x, fr.z) + dt * 0.3;
          gQ.slerp(eulerQ(yw, 0.18), Math.min(1, dt * 1.1));
        }
      }
      const k = opts.reduce ? 1 : Math.min(1, dt * (dragging ? 38 : aimQ ? 5.5 : 16));
      if (q.angleTo(gQ) > 0.0005) {
        q.slerp(gQ, k);
        dirty = true;
      }
    } else if (!dragging) {
      if (aim) {
        gYaw = aim.yaw;
        gPitch = aim.pitch;
      } else if (Math.abs(vYaw) > 0.01 || Math.abs(vPitch) > 0.01) {
        gYaw += vYaw * dt;
        gPitch = Math.max(-0.9, Math.min(1.3, gPitch + vPitch * dt));
        const damp = Math.exp(-dt * 3.4);
        vYaw *= damp;
        vPitch *= damp;
      } else if (!opts.reduce && now - idleAt > 1800 && fold > 0.98) {
        gYaw += dt * 0.3;
        gPitch += (0.18 - gPitch) * Math.min(1, dt * 1.2);
      }
    }
    // el giro dibujado sigue al buscado (rápido al arrastrar, más suave al ir a una cara)
    if (!free) {
      const follow = opts.reduce ? 1 : Math.min(1, dt * (dragging ? 26 : aim ? 5.5 : 14));
      if (Math.abs(gYaw - yaw) > 0.0004 || Math.abs(gPitch - pitch) > 0.0004) {
        yaw += (gYaw - yaw) * follow;
        pitch += (gPitch - pitch) * follow;
        dirty = true;
      }
      q.copy(eulerQ(yaw, pitch));
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
    spin.quaternion.identity().slerp(q, f);
    const bob = opts.reduce ? 0 : Math.sin(t * 1.4) * 0.025 * f;
    holder.position.y = bob;
    (shadow.material as THREE.MeshBasicMaterial).opacity = f;
    shadow.scale.setScalar(1 - bob * 1.5);

    drops.forEach((m, i) => {
      const k = i / drops.length;
      const ang = k * Math.PI * 2 - t * 0.5;
      const r = orbit + 0.06 * Math.sin(t * 1.3 + i);
      m.position.set(Math.cos(ang) * r, -0.42 + ((i * 4) % drops.length) / (drops.length - 1) * 0.95 + Math.sin(t * 2 + i * 1.7) * 0.05, Math.sin(ang) * r * 0.75);
      m.visible = f > 0.6;
      const grow = Math.max(0.0001, Math.min(1, (f - 0.6) / 0.4));
      if (opts.capsules) {
        // la cápsula avanza a lo largo de la órbita y rueda sobre su eje
        m.rotation.set(t * 0.9 + i, -ang, 0.15 * Math.sin(t + i), 'YXZ');
        const s = 0.13 * grow;
        m.scale.set(s * 1.6, s, s);
      } else {
        m.rotation.z = Math.sin(t * 1.6 + i) * 0.25;
        m.scale.setScalar(Math.max(0.0001, (0.07 + (i % 3) * 0.018) * grow));
      }
    });
    if (drops.length) dirty = true;

    // encuadre: la caja (alto 1) o el troquel (≈ 2·ancho + 2·fondo)
    const zoom = opts.zoom ?? 1;
    // con giro libre la caja puede quedar en cualquier posición: entra su diagonal en 3D, y también las cápsulas
    const diag3 = Math.hypot(W, H, D) * 1.06;
    const boxH = free ? Math.max(1.55, diag3) : 1.55;
    const boxW = free ? Math.max(1.25, diag3, opts.capsules ? (orbit + 0.2) * 2 : 0) : Math.max(1.25, Math.hypot(W, D) * 1.1);
    const needH = (boxH * f + (H + 2 * D) * 1.12 * u) / zoom;
    // sin giro libre, la caja entra entera aunque gire de lado (su diagonal); las gotas pueden salir por los bordes
    const needW = (boxW * f + (2 * W + 2 * D) * 1.1 * u) / zoom;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distH = needH / 2 / Math.tan(fov / 2);
    const distW = needW / 2 / Math.tan(fov / 2) / camera.aspect;
    const dist = Math.max(distH, distW);
    camera.position.set(0, 0.18 * f, dist);
    camera.lookAt(0, 0, 0);
    // radianes por píxel: un punto de la caja a ~0,6 del centro se mueve lo mismo que el dedo
    const ppu = vh / (2 * dist * Math.tan(fov / 2));
    pxRad = 1 / (Math.max(40, ppu) * 0.6);

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

  return {
    setFold(target, instant) {
      // el giro acumulado se lleva a una sola vuelta: al desplegarse no da varias vueltas de golpe
      const n = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      gYaw = n + (gYaw - yaw);
      yaw = n;
      vYaw = vPitch = wx = wy = 0;
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
    faceTo(face) {
      if (!face) {
        aim = null;
        aimQ = null;
        idleAt = performance.now();
        return;
      }
      const target = { front: [0, 0.12], right: [-Math.PI / 2, 0.12], back: [Math.PI, 0.12], left: [Math.PI / 2, 0.12], top: [0, 1.25], bottom: [0, -1.25] }[face];
      if (free) {
        // el cuaternión toma solo el camino más corto
        wx = wy = 0;
        aimQ = eulerQ(target[0], target[1]);
        dirty = true;
        return;
      }
      // el giro más corto desde donde está
      let ty = target[0];
      while (ty - gYaw > Math.PI) ty -= Math.PI * 2;
      while (ty - gYaw < -Math.PI) ty += Math.PI * 2;
      vYaw = vPitch = 0;
      aim = { yaw: ty, pitch: target[1] };
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
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
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
