import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoogleMapFrame } from '@/components/map/GoogleMapFrame';
import { Button, Chip, IconButton, goBack, styles } from '@/components/ui';
import { SAMPLE_LOCATION } from '@/lib/places';
import { useMine } from '@/store/AppStore';
import { colors, font, space } from '@/theme';

const SEARCHES = [
  { label: 'Consultorios', q: 'consultorios médicos' },
  { label: 'Médicos', q: 'médicos' },
  { label: 'Dermatólogos', q: 'dermatólogos' },
  { label: 'Pediatras', q: 'pediatras' },
  { label: 'Clínicas', q: 'clínicas' },
  { label: 'Hospitales', q: 'hospitales' },
];

// Google Maps integrado: búsqueda de consultorios y médicos cerca de tu ubicación
export default function MapaGoogle() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string }>();
  const lat = params.lat ? Number(params.lat) : SAMPLE_LOCATION.lat;
  const lon = params.lon ? Number(params.lon) : SAMPLE_LOCATION.lon;
  const { logEvent } = useMine();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState(SEARCHES[0].q);

  const openApp = () => {
    logEvent('google_maps_app');
    Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(q)}/@${lat},${lon},15z`).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={[styles.row, { gap: space.sm }]}>
          <IconButton icon="chevron-back" label="Volver" onPress={() => goBack('/mapa')} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.ink }}>Google Maps</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 11, color: colors.inkMuted }}>Lugares de salud cerca de {params.lat ? 'tu ubicación' : 'la zona de ejemplo'}</Text>
          </View>
          <Ionicons name="logo-google" size={20} color={colors.inkMuted} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {SEARCHES.map((s) => (
            <Chip
              key={s.q}
              label={s.label}
              selected={q === s.q}
              onPress={() => {
                setQ(s.q);
                logEvent('google_maps_busqueda', s.label);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <GoogleMapFrame query={q} lat={lat} lon={lon} />

      <View style={{ padding: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Button label="Abrir en la app de Google Maps" icon="open-outline" variant="secondary" onPress={openApp} />
      </View>
    </View>
  );
}
