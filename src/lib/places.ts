// Búsqueda de consultorios, clínicas y hospitales cercanos con OpenStreetMap (Overpass API).
// Es un servicio gratuito y sin clave. Si no hay conexión o el servicio no responde,
// se generan lugares de ejemplo claramente marcados como tales.

export type PlaceKind = 'visita' | 'consultorio' | 'clinica' | 'hospital';

export interface MapPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lon: number;
  subtitle?: string;
  visitId?: string;
  sample?: boolean;
}

export interface LatLon {
  lat: number;
  lon: number;
}

// Centro de Guayaquil: ubicación de ejemplo cuando no hay permiso de GPS
export const SAMPLE_LOCATION: LatLon = { lat: -2.1709, lon: -79.9224 };

export function distanceKm(a: LatLon, b: LatLon) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const KIND_FROM_TAG: Record<string, PlaceKind> = {
  doctors: 'consultorio',
  dentist: 'consultorio',
  clinic: 'clinica',
  hospital: 'hospital',
};

interface OverpassElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function fetchNearbyPlaces(at: LatLon, radiusKm: number): Promise<{ places: MapPlace[]; source: 'osm' | 'ejemplo' }> {
  const r = Math.round(radiusKm * 1000);
  const q = `[out:json][timeout:15];(
node["amenity"~"^(doctors|clinic|hospital|dentist)$"](around:${r},${at.lat},${at.lon});
way["amenity"~"^(doctors|clinic|hospital|dentist)$"](around:${r},${at.lat},${at.lon});
node["healthcare"~"^(doctor|clinic|hospital)$"](around:${r},${at.lat},${at.lon});
);out center 60;`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(q)}`,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { elements: OverpassElement[] };
    const seen = new Set<string>();
    const places: MapPlace[] = [];
    for (const el of json.elements ?? []) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      const name = tags.name ?? tags['name:es'];
      if (lat == null || lon == null || !name || seen.has(name)) continue;
      seen.add(name);
      const kind = KIND_FROM_TAG[tags.amenity] ?? (tags.healthcare === 'hospital' ? 'hospital' : tags.healthcare === 'clinic' ? 'clinica' : 'consultorio');
      const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
      places.push({
        id: `osm-${el.type}-${el.id}`,
        name,
        kind,
        lat,
        lon,
        subtitle: street || tags['healthcare:speciality'] || undefined,
      });
    }
    if (places.length === 0) return { places: samplePlaces(at, radiusKm), source: 'ejemplo' };
    return { places, source: 'osm' };
  } catch {
    return { places: samplePlaces(at, radiusKm), source: 'ejemplo' };
  }
}

// Lugares de ejemplo alrededor de un punto (posiciones fijas para que no cambien entre aperturas)
export function samplePlaces(at: LatLon, radiusKm: number): MapPlace[] {
  const base: { name: string; kind: PlaceKind; a: number; d: number }[] = [
    { name: 'Consultorio Médico Central (ejemplo)', kind: 'consultorio', a: 20, d: 0.35 },
    { name: 'Centro Dermatológico del Sur (ejemplo)', kind: 'consultorio', a: 110, d: 0.55 },
    { name: 'Clínica Familiar Norte (ejemplo)', kind: 'clinica', a: 200, d: 0.7 },
    { name: 'Consultorio Pediátrico Las Palmas (ejemplo)', kind: 'consultorio', a: 300, d: 0.45 },
    { name: 'Hospital General Ribera (ejemplo)', kind: 'hospital', a: 250, d: 0.9 },
    { name: 'Policlínico La Alborada (ejemplo)', kind: 'clinica', a: 60, d: 0.8 },
    { name: 'Consultorio de Medicina General (ejemplo)', kind: 'consultorio', a: 160, d: 0.25 },
    { name: 'Centro Médico Integral (ejemplo)', kind: 'clinica', a: 340, d: 0.65 },
  ];
  return base.map((b, i) => {
    const km = b.d * radiusKm;
    const rad = (b.a * Math.PI) / 180;
    return {
      id: `ej-${i}`,
      name: b.name,
      kind: b.kind,
      lat: at.lat + (km / 111) * Math.cos(rad),
      lon: at.lon + (km / (111 * Math.cos((at.lat * Math.PI) / 180))) * Math.sin(rad),
      subtitle: 'Ubicación de ejemplo',
      sample: true,
    };
  });
}

export function directionsUrl(p: LatLon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
}
