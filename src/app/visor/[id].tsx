import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HotspotCard, Product3D } from '@/components/Product3D';
import { goBack } from '@/components/ui';
import { productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space } from '@/theme';

// Visor 3D inmersivo: el modelo ocupa toda la pantalla.
// Gestos: arrastrar para girar 360°, pellizcar (o rueda del ratón) para acercar,
// doble toque para restablecer, tocar los puntos para ver su texto.
export default function Visor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = productById(id);
  const { logEvent } = useMine();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [spot, setSpot] = useState<number | null>(null);

  const close = () => goBack(p ? `/producto/${p.id}` : '/');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={[colors.white, colors.primarySoft]} style={StyleSheet.absoluteFill} />

      {p ? (
        <Product3D
          product={p}
          width={width}
          height={height}
          fullGestures
          active={spot}
          onActiveChange={(i) => {
            setSpot(i);
            if (i !== null) logEvent('punto_3d', p.hotspots?.[i]?.title);
          }}
        />
      ) : null}

      {/* cerrar y nombre: lo único fijo en pantalla */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar visor"
          hitSlop={8}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
        <View pointerEvents="none" style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: colors.ink }} numberOfLines={1}>
            {p?.name ?? 'Producto no encontrado'}
          </Text>
          <Text style={{ fontFamily: font.medium, fontSize: 11, color: colors.inkMuted }}>Visor 3D simulado · 360°</Text>
        </View>
        {p ? (
          <Pressable
            onPress={() => router.push(`/ar/${p.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Ver en realidad aumentada"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.petroleo, opacity: pressed ? 0.75 : 1 })}
          >
            <Ionicons name="scan-outline" size={17} color={colors.white} />
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.white }}>AR</Text>
          </Pressable>
        ) : null}
      </View>

      {/* texto del punto seleccionado, flotando sobre el modelo */}
      {p ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.xl }}>
          <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', borderRadius: radius.lg }}>
            <HotspotCard hotspot={spot === null ? null : p.hotspots?.[spot] ?? null} index={spot ?? 0} onClose={() => setSpot(null)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
