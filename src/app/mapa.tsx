import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { AppHeader, Avatar, Button, Card, DemoNotice, Screen, StatusPill, styles } from '@/components/ui';
import { dayLabel, personById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

// Mapa de cobertura ilustrativo (sin geolocalización real)
export default function Mapa() {
  const { visita } = useLocalSearchParams<{ visita?: string }>();
  const { myVisits } = useMine();
  const upcoming = myVisits.filter((v) => v.dayOffset >= 0).sort((a, b) => a.dayOffset - b.dayOffset || a.time.localeCompare(b.time));
  const [sel, setSel] = useState(visita ?? upcoming[0]?.id);
  const { width } = useWindowDimensions();
  const W = Math.min(width, 720) - space.lg * 2;
  const H = W * 0.9;
  const selected = upcoming.find((v) => v.id === sel);

  return (
    <Screen header={<AppHeader title="Mapa de cobertura" subtitle="Zona Guayaquil · Durán · Milagro" />}>
      <View style={{ width: W, height: H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#EAF2F3', borderWidth: 1, borderColor: colors.border }}>
        {/* cuadrícula de calles */}
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: (H / 7) * i + 18, height: i % 3 === 0 ? 6 : 2, backgroundColor: colors.white }} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: (W / 6) * i + 22, width: i % 2 === 0 ? 6 : 2, backgroundColor: colors.white }} />
        ))}
        {/* río (ilustrativo) */}
        <View style={{ position: 'absolute', left: W * 0.56, top: 0, bottom: 0, width: 26, backgroundColor: '#BFE3EA' }} />
        <View style={{ position: 'absolute', left: W * 0.08, top: H * 0.62, width: W * 0.3, height: H * 0.22, borderRadius: radius.lg, backgroundColor: '#D7EBDD' }} />
        <Text style={{ position: 'absolute', left: W * 0.1, top: H * 0.86, fontFamily: font.semibold, fontSize: 10, color: colors.inkMuted }}>GUAYAQUIL</Text>
        <Text style={{ position: 'absolute', left: W * 0.66, top: H * 0.66, fontFamily: font.semibold, fontSize: 10, color: colors.inkMuted }}>DURÁN</Text>
        <Text style={{ position: 'absolute', right: 10, bottom: 8, fontFamily: font.semibold, fontSize: 10, color: colors.inkMuted }}>→ MILAGRO</Text>

        {upcoming.map((v, i) => {
          const on = v.id === sel;
          return (
            <Pressable
              key={v.id}
              onPress={() => setSel(v.id)}
              accessibilityRole="button"
              accessibilityLabel={`Visita ${i + 1}: ${personById(v.doctorId).name}`}
              style={{ position: 'absolute', left: v.pin.x * W - 18, top: v.pin.y * H - 40, alignItems: 'center' }}
            >
              <View
                style={{
                  width: on ? 40 : 34,
                  height: on ? 40 : 34,
                  borderRadius: 20,
                  backgroundColor: on ? colors.primary : colors.ink,
                  borderWidth: 3,
                  borderColor: colors.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: font.bold, color: colors.white, fontSize: 13 }}>{i + 1}</Text>
              </View>
              <View style={{ width: 3, height: 8, backgroundColor: on ? colors.primary : colors.ink }} />
            </Pressable>
          );
        })}
      </View>
      <DemoNotice text="Mapa ilustrativo con ubicaciones de ejemplo. No usa GPS ni navegación en tiempo real." />

      {selected ? (
        <Card>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={type.overline}>
              {dayLabel(selected.dayOffset)} · {selected.time}
            </Text>
            <StatusPill status={selected.status} />
          </View>
          <View style={styles.row}>
            <Avatar initials={personById(selected.doctorId).initials} tone="dark" />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{personById(selected.doctorId).name}</Text>
              <Text style={type.caption}>{selected.place}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={14} color={colors.inkMuted} />
            <Text style={[type.caption, { flex: 1 }]}>{selected.address}</Text>
          </View>
          <Button label="Abrir visita" small onPress={() => router.push(`/visita/${selected.id}`)} />
        </Card>
      ) : null}

      <Text style={type.h3}>Ruta sugerida</Text>
      {upcoming.map((v, i) => (
        <Pressable key={v.id} onPress={() => setSel(v.id)} style={[styles.listItem, v.id === sel && { borderColor: colors.primary }]} accessibilityRole="button">
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: v.id === sel ? colors.primary : colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.white, fontFamily: font.bold, fontSize: 12 }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>{personById(v.doctorId).name}</Text>
            <Text style={type.caption}>
              {dayLabel(v.dayOffset)} · {v.time} · {v.place}
            </Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
