import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { colors } from '@/theme';
import { KIND_STYLE, type PlacesMapProps } from './types';

// Mapa real (Apple Maps en iPhone, Google Maps en Android) con tu ubicación y los lugares cercanos
export function PlacesMap({ center, user, places, selectedId, onSelect, radiusKm, recenterKey }: PlacesMapProps) {
  const map = useRef<MapView>(null);
  const delta = (radiusKm / 111) * 2.6;

  useEffect(() => {
    map.current?.animateToRegion({ latitude: center.lat, longitude: center.lon, latitudeDelta: delta, longitudeDelta: delta }, 500);
  }, [recenterKey, center.lat, center.lon, delta]);

  useEffect(() => {
    const p = places.find((x) => x.id === selectedId);
    if (p) map.current?.animateToRegion({ latitude: p.lat - delta * 0.12, longitude: p.lon, latitudeDelta: delta * 0.6, longitudeDelta: delta * 0.6 }, 450);
  }, [selectedId, places, delta]);

  return (
    <MapView
      ref={map}
      style={{ flex: 1 }}
      initialRegion={{ latitude: center.lat, longitude: center.lon, latitudeDelta: delta, longitudeDelta: delta }}
      showsUserLocation={!!user}
      showsMyLocationButton={false}
      showsCompass
      rotateEnabled
      pitchEnabled
      onPress={(e) => {
        if (e.nativeEvent.action !== 'marker-press') onSelect(null);
      }}
    >
      <Circle
        center={{ latitude: center.lat, longitude: center.lon }}
        radius={radiusKm * 1000}
        strokeColor="rgba(30,127,140,0.5)"
        fillColor="rgba(99,201,214,0.10)"
      />
      {places.map((p) => {
        const k = KIND_STYLE[p.kind];
        const on = p.id === selectedId;
        return (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lon }}
            onPress={() => onSelect(p.id)}
            title={p.name}
            tracksViewChanges={on}
          >
            <View
              style={{
                width: on ? 40 : 30,
                height: on ? 40 : 30,
                borderRadius: 20,
                backgroundColor: k.color,
                borderWidth: 3,
                borderColor: on ? colors.turquesa : colors.white,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={k.icon} size={on ? 20 : 15} color={colors.white} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}
