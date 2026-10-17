import { View } from 'react-native';

// Versión web: Google Maps solo permite incrustarse con su formato "embed"
export function GoogleMapFrame({ query, lat, lon }: { query: string; lat: number; lon: number }) {
  const url = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&ll=${lat},${lon}&z=14&hl=es&output=embed`;
  return (
    <View style={{ flex: 1, backgroundColor: '#EAF1EE' }}>
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
