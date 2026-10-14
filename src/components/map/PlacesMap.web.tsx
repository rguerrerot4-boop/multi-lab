import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { colors, font } from '@/theme';
import { KIND_STYLE, type PlacesMapProps } from './types';

// Versión web del mapa: ilustrativa (el navegador de la vista previa no permite cargar mapas externos).
// Se puede arrastrar y acercar con la rueda del ratón o pellizcando; muestra los mismos lugares.
export function PlacesMap({ center, user, places, selectedId, onSelect, radiusKm, recenterKey, route, routeApprox }: PlacesMapProps) {
  const [box, setBox] = useState({ w: 360, h: 500 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const start = useRef({ x: 0, y: 0, d: 0, z: 1 });
  const host = useRef<View>(null);

  const base = Math.min(box.w, box.h) / (radiusKm * 2.6); // píxeles por km
  const k = base * zoom;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const toXY = (lat: number, lon: number) => ({
    x: box.w / 2 + (lon - center.lon) * 111 * cosLat * k + pan.x,
    y: box.h / 2 - (lat - center.lat) * 111 * k + pan.y,
  });

  const animatePan = (to: { x: number; y: number }) => {
    const from = panRef.current;
    const t0 = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / 420);
      const e = 1 - Math.pow(1 - t, 3);
      setPan({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    setZoom(1);
    animatePan({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey, center.lat, center.lon, radiusKm]);

  useEffect(() => {
    if (!route || route.length < 2) return;
    const a = route[0];
    const b = route[route.length - 1];
    const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
    animatePan({ x: -(mid.lon - center.lon) * 111 * cosLat * k, y: (mid.lat - center.lat) * 111 * k - box.h * 0.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    if (route) return;
    const p = places.find((x) => x.id === selectedId);
    if (!p) return;
    const dx = (p.lon - center.lon) * 111 * cosLat * k;
    const dy = -(p.lat - center.lat) * 111 * k;
    animatePan({ x: -dx, y: -dy - box.h * 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 3,
        onPanResponderGrant: () => {
          start.current = { x: panRef.current.x, y: panRef.current.y, d: 0, z: zoomRef.current };
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
          if (t && t.length >= 2) {
            const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            if (!start.current.d) start.current.d = d;
            else setZoom(Math.max(0.5, Math.min(4, (start.current.z * d) / start.current.d)));
            return;
          }
          setPan({ x: start.current.x + g.dx, y: start.current.y + g.dy });
        },
      }),
    [],
  );
  // rueda del ratón para acercar y alejar; el navegador no se lleva los gestos del mapa
  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    el.style.touchAction = 'none';
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      setZoom((z) => Math.max(0.5, Math.min(4, z * (ev.deltaY > 0 ? 0.9 : 1.1))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // calles ilustrativas: una cuadrícula que se mueve y escala con el mapa
  const grid = 0.3 * k; // cada 300 m
  const lines: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];
  if (grid > 8) {
    const ox = ((box.w / 2 + pan.x) % grid) - grid;
    const oy = ((box.h / 2 + pan.y) % grid) - grid;
    for (let x = ox, i = 0; x < box.w + grid; x += grid, i++) lines.push({ x1: x, y1: 0, x2: x, y2: box.h, w: i % 4 === 0 ? 7 : 3 });
    for (let y = oy, i = 0; y < box.h + grid; y += grid, i++) lines.push({ x1: 0, y1: y, x2: box.w, y2: y, w: i % 4 === 0 ? 7 : 3 });
  }
  const river = [
    [-2.05, -79.879],
    [-2.12, -79.874],
    [-2.17, -79.879],
    [-2.22, -79.871],
    [-2.3, -79.875],
  ]
    .map(([la, lo]) => toXY(la, lo))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
  const c = toXY(center.lat, center.lon);
  const me = user ? toXY(user.lat, user.lon) : null;

  return (
    <View
      ref={host}
      style={{ flex: 1, overflow: 'hidden', backgroundColor: '#EAF1EE' }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      {...responder.panHandlers}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onSelect(null)} accessibilityLabel="Mapa">
        <Svg width={box.w} height={box.h}>
          <Rect x={0} y={0} width={box.w} height={box.h} fill="#EAF1EE" />
          {lines.map((l, i) => (
            <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#FFFFFF" strokeWidth={l.w} />
          ))}
          <Polyline points={river} fill="none" stroke="#BFE0E8" strokeWidth={Math.max(14, 0.35 * k)} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={c.x} cy={c.y} r={radiusKm * k} fill="rgba(99,201,214,0.12)" stroke="rgba(30,127,140,0.45)" strokeWidth={1.5} />
          {route && route.length > 1 ? (
            <Polyline
              points={route.map((r) => toXY(r.lat, r.lon)).map((q) => `${q.x},${q.y}`).join(' ')}
              fill="none"
              stroke={colors.primary}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={routeApprox ? '12 9' : undefined}
            />
          ) : null}
        </Svg>
      </Pressable>

      {me ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: me.x - 11, top: me.y - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(30,127,140,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white }} />
        </View>
      ) : null}

      {places.map((p) => {
        const pt = toXY(p.lat, p.lon);
        if (pt.x < -40 || pt.y < -40 || pt.x > box.w + 40 || pt.y > box.h + 40) return null;
        const ks = KIND_STYLE[p.kind];
        const on = p.id === selectedId;
        const size = on ? 40 : 30;
        return (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p.id)}
            accessibilityRole="button"
            accessibilityLabel={p.name}
            hitSlop={6}
            style={{ position: 'absolute', left: pt.x - size / 2, top: pt.y - size, alignItems: 'center', zIndex: on ? 10 : 1 }}
          >
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ks.color, borderWidth: 3, borderColor: on ? colors.turquesa : colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={ks.icon} size={on ? 20 : 15} color={colors.white} />
            </View>
          </Pressable>
        );
      })}

      <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ fontFamily: font.medium, fontSize: 10, color: colors.inkMuted }}>Mapa ilustrativo (vista web) · en la app se usa el mapa real</Text>
      </View>
    </View>
  );
}
