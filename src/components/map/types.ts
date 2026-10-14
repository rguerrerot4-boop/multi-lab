import type { LatLon, MapPlace, PlaceKind } from '@/lib/places';
import type { IconName } from '@/data/mock';
import { colors } from '@/theme';

export interface PlacesMapProps {
  center: LatLon; // punto donde se centra la búsqueda (tu ubicación o la de ejemplo)
  user: LatLon | null; // tu ubicación real, si diste permiso
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  radiusKm: number;
  recenterKey: number; // al cambiar, el mapa vuelve a tu ubicación
}

export const KIND_STYLE: Record<PlaceKind, { color: string; icon: IconName; label: string }> = {
  visita: { color: colors.primary, icon: 'calendar', label: 'Mi visita' },
  consultorio: { color: colors.petroleo, icon: 'medkit', label: 'Consultorio' },
  clinica: { color: '#3E8E9B', icon: 'business', label: 'Clínica' },
  hospital: { color: colors.danger, icon: 'add-circle', label: 'Hospital' },
};
