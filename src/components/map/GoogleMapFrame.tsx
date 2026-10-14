import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '@/theme';

// Google Maps dentro de la app (página móvil de Google Maps en una ventana integrada)
export function GoogleMapFrame({ query, lat, lon }: { query: string; lat: number; lon: number }) {
  const [loading, setLoading] = useState(true);
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lon},15z?hl=es`;
  return (
    <View style={{ flex: 1 }}>
      <WebView
        key={url}
        source={{ uri: url }}
        style={{ flex: 1 }}
        geolocationEnabled
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => setLoading(false)}
        setSupportMultipleWindows={false}
      />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
    </View>
  );
}
