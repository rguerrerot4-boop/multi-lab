// Cálculo de rutas con el servicio público de OSRM (OpenStreetMap), gratuito y sin clave.
// Si no hay conexión, se dibuja una ruta aproximada en línea recta con tiempos estimados.
import { distanceKm, type LatLon } from './places';

export interface RouteResult {
  coords: LatLon[];
  distanceKm: number;
  driveMin: number;
  walkMin: number;
  approx: boolean; // true si es una estimación en línea recta
}

const WALK_KMH = 4.8;
const CITY_KMH = 24;

export async function fetchRoute(from: LatLon, to: LatLon): Promise<RouteResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (!r) throw new Error('sin ruta');
    const km = r.distance / 1000;
    return {
      coords: r.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
      distanceKm: km,
      driveMin: Math.max(1, Math.round(r.duration / 60)),
      walkMin: Math.max(1, Math.round((km / WALK_KMH) * 60)),
      approx: false,
    };
  } catch {
    const km = distanceKm(from, to) * 1.3; // las calles no van en línea recta
    return {
      coords: [from, to],
      distanceKm: km,
      driveMin: Math.max(1, Math.round((km / CITY_KMH) * 60)),
      walkMin: Math.max(1, Math.round((km / WALK_KMH) * 60)),
      approx: true,
    };
  }
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
