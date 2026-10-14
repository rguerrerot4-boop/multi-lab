import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { colors, font, space } from '@/theme';

// Versión web: Google Maps solo permite incrustarse con su formato "embed".
// La vista previa de Claude bloquea sitios externos, así que se avisa arriba del mapa.
export function GoogleMapFrame({ query, lat, lon }: { query: string; lat: number; lon: number }) {
  const url = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&ll=${lat},${lon}&z=14&hl=es&output=embed`;
  return (
    <View style={{ flex: 1, backgroundColor: '#EAF1EE' }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.warningSoft, paddingHorizontal: space.md, paddingVertical: 8 }}>
        <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
        <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 11, lineHeight: 15, color: colors.warning }}>
          Si el mapa no carga aquí es porque esta vista previa bloquea sitios externos. En la app instalada se ve Google Maps completo.
        </Text>
      </View>
      <iframe
        key={url}
        src={url}
        title="Google Maps"
        style={{ border: 0, width: '100%', flex: 1, minHeight: 300 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allow="geolocation"
      />
    </View>
  );
}
