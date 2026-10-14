import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { HotspotCard, Product3D, type Product3DHandle } from '@/components/Product3D';
import { AppHeader, DemoNotice, EmptyState, Screen, styles } from '@/components/ui';
import { productById, type IconName } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

// Visor 3D a pantalla completa: giro libre 360°, zoom, puntos interactivos con texto
export default function Visor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = productById(id);
  const { logEvent } = useMine();
  const { width, height } = useWindowDimensions();
  const [spot, setSpot] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [zoom, setZoom] = useState(1);
  const viewer = useRef<Product3DHandle>(null);
  const size = Math.min(width - space.lg * 2, height * 0.5, 460);

  if (!p) {
    return (
      <Screen header={<AppHeader title="Visor 3D" />}>
        <EmptyState icon="cube-outline" title="Producto no encontrado" body="" />
      </Screen>
    );
  }

  const select = (i: number | null) => {
    setSpot(i);
    if (i !== null) logEvent('punto_3d', p.hotspots?.[i]?.title);
  };

  return (
    <Screen header={<AppHeader title="Visor 3D" subtitle={p.name} />}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: space.md, gap: space.md, overflow: 'hidden' }}>
        <Product3D ref={viewer} product={p} size={size} autoRotate={auto} zoom={zoom} active={spot} onActiveChange={select} />

        <View style={[styles.row, { justifyContent: 'center', gap: space.sm }]}>
          <Control icon="remove" label="Alejar" onPress={() => setZoom((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))} />
          <Control
            icon="refresh"
            label="Restablecer vista"
            onPress={() => {
              setSpot(null);
              setZoom(1);
              viewer.current?.reset();
            }}
          />
          <Control icon={auto ? 'pause' : 'play'} label={auto ? 'Detener giro automático' : 'Girar automáticamente'} active={auto} onPress={() => setAuto((a) => !a)} />
          <Control icon="add" label="Acercar" onPress={() => setZoom((z) => Math.min(1.5, +(z + 0.15).toFixed(2)))} />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>Puntos del producto</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {(p.hotspots ?? []).map((h, i) => (
            <Pressable
              key={h.title}
              onPress={() => select(spot === i ? null : i)}
              accessibilityRole="button"
              accessibilityState={{ selected: spot === i }}
              style={[styles.chip, spot === i && { backgroundColor: colors.petroleo, borderColor: colors.petroleo }]}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: spot === i ? colors.turquesa : colors.primary }}>{i + 1}</Text>
              <Text style={[type.label, { color: spot === i ? colors.white : colors.ink }]} numberOfLines={1}>
                {h.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <HotspotCard hotspot={spot === null ? null : p.hotspots?.[spot] ?? null} index={spot ?? 0} onClose={() => setSpot(null)} />
      <DemoNotice text="Representación 3D simulada con fines de demostración. El modelo real con Vectary está pendiente." />
    </Screen>
  );
}

function Control({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.primary : colors.primarySoft,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={active ? colors.white : colors.primary} />
    </Pressable>
  );
}
