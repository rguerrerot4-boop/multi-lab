import Ionicons from '@expo/vector-icons/Ionicons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { colors } from '@/theme';
import { KIND_STYLE, type PlacesMapProps } from './types';

// Versión web: mapa real con Leaflet y mapas base de OpenStreetMap (gratis, sin clave).
// Hace lo mismo que el mapa del teléfono: radio de búsqueda, tu ubicación, lugares y ruta.
const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';

const glyph = (name: keyof typeof Ionicons.glyphMap) => String.fromCodePoint(Ionicons.glyphMap[name] as number);

function placeIcon(kind: keyof typeof KIND_STYLE, on: boolean) {
  const k = KIND_STYLE[kind];
  const size = on ? 40 : 30;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;background:${k.color};border:3px solid ${on ? colors.turquesa : colors.white};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(32,52,58,.35);color:${colors.white};font-family:ionicons;font-size:${on ? 20 : 15}px;line-height:1">${glyph(k.icon)}</div>`,
  });
}

const userIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:rgba(30,127,140,.25);display:flex;align-items:center;justify-content:center"><div style="width:12px;height:12px;border-radius:50%;box-sizing:border-box;background:${colors.primary};border:2px solid ${colors.white}"></div></div>`,
});

export function PlacesMap({ center, user, places, selectedId, onSelect, radiusKm, recenterKey, route, routeApprox }: PlacesMapProps) {
  const host = useRef<View>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ circle?: L.Circle; user?: L.Marker; route?: L.Polyline; places?: L.LayerGroup }>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // crea el mapa una sola vez
  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    // sin botones de zoom: en el celular se acerca pellizcando, como en la app
    const m = L.map(el, { zoomControl: false, attributionControl: true });
    m.attributionControl.setPrefix(false);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 19 }).addTo(m);
    m.on('click', () => onSelectRef.current(null));
    layers.current.places = L.layerGroup().addTo(m);
    map.current = m;
    // el contenedor cambia de tamaño al girar el teléfono o mostrar paneles
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      layers.current = {};
    };
  }, []);

  // radio de búsqueda; al cambiar el centro o el radio (o al pulsar "mi ubicación") se vuelve a encuadrar
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.circle?.remove();
    const c = L.circle([center.lat, center.lon], { radius: radiusKm * 1000, color: 'rgba(30,127,140,0.5)', weight: 1.5, fillColor: 'rgba(99,201,214,0.10)', fillOpacity: 1, interactive: false }).addTo(m);
    layers.current.circle = c;
    const bounds = L.latLng(center.lat, center.lon).toBounds(radiusKm * 1000 * 2.6);
    if (m.getZoom() === undefined) m.fitBounds(bounds);
    else m.flyToBounds(bounds, { duration: 0.5 });
  }, [recenterKey, center.lat, center.lon, radiusKm]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.user?.remove();
    layers.current.user = user ? L.marker([user.lat, user.lon], { icon: userIcon, interactive: false, keyboard: false }).addTo(m) : undefined;
  }, [user?.lat, user?.lon]);

  useEffect(() => {
    const g = layers.current.places;
    if (!g) return;
    g.clearLayers();
    for (const p of places) {
      const on = p.id === selectedId;
      L.marker([p.lat, p.lon], { icon: placeIcon(p.kind, on), title: p.name, alt: p.name, zIndexOffset: on ? 1000 : 0 })
        .on('click', () => onSelectRef.current(p.id))
        .addTo(g);
    }
  }, [places, selectedId]);

  // al trazar una ruta, el mapa se ajusta para mostrarla completa
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layers.current.route?.remove();
    layers.current.route = undefined;
    if (!route || route.length < 2) return;
    const line = L.polyline(
      route.map((c) => [c.lat, c.lon] as [number, number]),
      { color: colors.primary, weight: 6, opacity: 0.9, dashArray: routeApprox ? '10 8' : undefined, interactive: false },
    ).addTo(m);
    layers.current.route = line;
    m.flyToBounds(line.getBounds(), { paddingTopLeft: [60, 160], paddingBottomRight: [60, 300], duration: 0.6 });
  }, [route, routeApprox]);

  // al elegir un lugar se acerca y lo deja un poco arriba del centro (abajo va la tarjeta)
  useEffect(() => {
    const m = map.current;
    if (!m || route) return;
    const p = places.find((x) => x.id === selectedId);
    if (!p) return;
    const z = Math.max(m.getZoom(), 15);
    const pt = m.project([p.lat, p.lon], z).add([0, m.getSize().y * 0.12]);
    m.flyTo(m.unproject(pt, z), z, { duration: 0.45 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <View ref={host} style={{ flex: 1, backgroundColor: colors.bg }} />;
}
