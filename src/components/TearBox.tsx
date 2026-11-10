// Caja de TEARSOFT en 3D. En la web se dibuja con three.js (src/lib/boxGL.ts): se gira con el dedo, flota
// con gotas alrededor y se despliega en su troquel. En la app nativa (o si WebGL falla) se usa la caja con
// fotos de CORAESSENS (PhotoBox3D), que también se gira con el dedo; el troquel se muestra plano (BoxNet).
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, View, type ImageSourcePropType } from 'react-native';
import { PhotoBox3D, type BoxFace, type BoxTextures } from '@/components/PhotoBox3D';
import type { BoxGL } from '@/lib/boxGL';
import { domEl } from '@/lib/webAnim';

const uriOf = (src: ImageSourcePropType): string => {
  const s = src as unknown as { uri?: string } | string | number;
  if (typeof s === 'string') return s;
  if (typeof s === 'object' && s && 'uri' in s && s.uri) return s.uri;
  return String(s);
};

export function TearBox({
  textures,
  dims,
  width,
  height,
  fold = 1,
  drops = false,
  highlight = null,
  active = true,
  reduce = false,
  zoom = 1,
  onReady,
}: {
  textures: BoxTextures;
  dims: { w: number; h: number; d: number };
  width: number;
  height: number;
  /** 1 = armada, 0 = desplegada */
  fold?: number;
  drops?: boolean;
  highlight?: BoxFace | null;
  /** se pausa el dibujo cuando no está a la vista */
  active?: boolean;
  reduce?: boolean;
  zoom?: number;
  onReady?: () => void;
}) {
  const host = useRef<View>(null);
  const gl = useRef<BoxGL | null>(null);
  const [failed, setFailed] = useState(Platform.OS !== 'web');
  const ready = useRef(onReady);
  ready.current = onReady;
  const urls = {
    front: uriOf(textures.front),
    right: uriOf(textures.right),
    back: uriOf(textures.back),
    left: uriOf(textures.left),
    top: uriOf(textures.top),
    bottom: uriOf(textures.bottom),
  };
  const urlKey = Object.values(urls).join('|');

  // crea el lienzo una sola vez
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = domEl(host.current);
    if (!el) return;
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    el.appendChild(canvas);
    let dead = false;
    import('@/lib/boxGL')
      .then((m) => {
        if (dead) return;
        gl.current = m.createBoxGL(canvas, { urls, dims, drops, reduce, zoom, onReady: () => ready.current?.() });
        gl.current.setFold(fold, true);
        gl.current.resize(width, height);
      })
      .catch(() => {
        canvas.remove();
        setFailed(true);
        ready.current?.();
      });
    return () => {
      dead = true;
      gl.current?.dispose();
      gl.current = null;
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => gl.current?.resize(width, height), [width, height]);
  useEffect(() => gl.current?.setFold(fold), [fold]);
  useEffect(() => gl.current?.setActive(active), [active]);
  useEffect(() => gl.current?.setHighlight(highlight), [highlight]);
  useEffect(() => {
    gl.current?.setTextures(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  if (failed) {
    if (fold < 0.5) return <BoxNet textures={textures} dims={dims} width={width} height={height} highlight={highlight} />;
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <PhotoBox3D textures={textures} dims={dims} width={width} height={height} fill={0.72} float={!reduce} reduceMotion={reduce} paused={!active} edge="#E8EEF5" />
      </View>
    );
  }
  return <View ref={host} style={{ width, height }} accessibilityLabel="Caja en 3D: arrástrala de lado para girarla" />;
}

/** Troquel plano de la caja (las seis fotos en cruz), para la app nativa */
export function BoxNet({ textures, dims, width, height, highlight }: { textures: BoxTextures; dims: { w: number; h: number; d: number }; width: number; height: number; highlight?: BoxFace | null }) {
  const W = dims.w;
  const H = dims.h;
  const D = dims.d;
  const totalW = 2 * W + 2 * D;
  const totalH = H + 2 * D;
  const k = Math.min(width / totalW, height / totalH) * 0.94;
  const ox = (width - totalW * k) / 2;
  const oy = (height - totalH * k) / 2;
  const cell = (face: BoxFace, x: number, y: number, w: number, h: number, flip = false) => (
    <View
      key={face}
      style={{
        position: 'absolute',
        left: ox + x * k,
        top: oy + y * k,
        width: w * k,
        height: h * k,
        borderWidth: highlight === face ? 2 : 0.5,
        borderColor: highlight === face ? '#32316C' : 'rgba(30,29,74,0.25)',
        overflow: 'hidden',
      }}
    >
      <Image source={textures[face]} style={{ width: '100%', height: '100%', transform: flip ? [{ rotate: '180deg' }] : [] }} resizeMode="stretch" />
    </View>
  );
  return (
    <View style={{ width, height }} accessibilityLabel="Caja desplegada: las seis caras del empaque">
      {cell('left', 0, D, D, H)}
      {cell('front', D, D, W, H)}
      {cell('right', D + W, D, D, H)}
      {cell('back', 2 * D + W, D, W, H)}
      {cell('top', D, 0, W, D)}
      {cell('bottom', D, D + H, W, D, true)}
    </View>
  );
}
