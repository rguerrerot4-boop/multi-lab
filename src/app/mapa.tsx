import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlacesMap } from '@/components/map/PlacesMap';
import { KIND_STYLE } from '@/components/map/types';
import { Button, Chip, goBack, styles } from '@/components/ui';
import { dayLabel, personById } from '@/data/mock';
import { SAMPLE_LOCATION, directionsUrl, distanceKm, fetchNearbyPlaces, formatDistance, type LatLon, type MapPlace, type PlaceKind } from '@/lib/places';
import { fetchRoute, formatMinutes, type RouteResult } from '@/lib/routing';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, shadow, space, type } from '@/theme';

type Phase = 'ask' | 'locating' | 'ready';
const FILTERS: { key: 'todo' | PlaceKind; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'visita', label: 'Mis visitas' },
  { key: 'consultorio', label: 'Consultorios' },
  { key: 'clinica', label: 'Clínicas' },
  { key: 'hospital', label: 'Hospitales' },
];
const RADII = [1, 2, 5];

// Mapa de cobertura: tu ubicación, tus visitas y los consultorios cercanos
export default function Mapa() {
  const { visita } = useLocalSearchParams<{ visita?: string }>();
  const { myVisits, role, logEvent } = useMine();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('locating');
  const [user, setUser] = useState<LatLon | null>(null);
  const [usingSample, setUsingSample] = useState(false);
  const [denied, setDenied] = useState(false);
  const [nearby, setNearby] = useState<MapPlace[]>([]);
  const [source, setSource] = useState<'osm' | 'ejemplo' | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [filter, setFilter] = useState<'todo' | PlaceKind>('todo');
  const [radiusKm, setRadiusKm] = useState(2);
  const [selected, setSelected] = useState<string | null>(visita ? `v-${visita}` : null);
  const [recenter, setRecenter] = useState(0);
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState<(RouteResult & { to: string }) | null>(null);
  const [routing, setRouting] = useState(false);
  const sheet = useRef(new Animated.Value(0)).current;

  const center = user ?? SAMPLE_LOCATION;

  // tus visitas como lugares del mapa
  const visitPlaces: MapPlace[] = useMemo(
    () =>
      myVisits
        .filter((v) => v.dayOffset >= 0)
        .map((v) => ({
          id: `v-${v.id}`,
          name: role === 'visitador' ? personById(v.doctorId).name : v.place,
          kind: 'visita' as const,
          lat: v.lat,
          lon: v.lon,
          subtitle: `${dayLabel(v.dayOffset)} · ${v.time} · ${v.place}`,
          visitId: v.id,
        })),
    [myVisits, role],
  );

  const all = useMemo(() => [...visitPlaces, ...nearby], [visitPlaces, nearby]);
  const shown = useMemo(
    () =>
      all
        .filter((p) => filter === 'todo' || p.kind === filter)
        .filter((p) => !query.trim() || `${p.name} ${p.subtitle ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
        .map((p) => ({ ...p, km: distanceKm(center, p) }))
        .sort((a, b) => a.km - b.km),
    [all, filter, center, query],
  );
  const sel = all.find((p) => p.id === selected);

  useEffect(() => {
    Animated.spring(sheet, { toValue: sel ? 1 : 0, friction: 8, tension: 80, useNativeDriver: true }).start();
  }, [sel, sheet]);

  const loadPlaces = useCallback(async (at: LatLon, r: number) => {
    setLoadingPlaces(true);
    const res = await fetchNearbyPlaces(at, r);
    setNearby(res.places);
    setSource(res.source);
    setLoadingPlaces(false);
  }, []);

  const fallbackToSample = useCallback(() => {
    setUser(null);
    setUsingSample(true);
    setPhase('ready');
  }, []);

  const locate = useCallback(async () => {
    setPhase('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setDenied(true);
        fallbackToSample();
        return;
      }
      setDenied(false);
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
      ]);
      setUser({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setUsingSample(false);
      setPhase('ready');
      setRecenter((n) => n + 1);
      logEvent('ubicacion_permitida');
    } catch {
      setDenied(true);
      fallbackToSample();
    }
  }, [logEvent, fallbackToSample]);

  // al abrir: si ya hay permiso, ubicar directo; si no, mostrar la explicación antes de pedirlo
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === 'granted') return locate();
      } catch {
        // el navegador puede no permitir consultar el permiso
      }
      setPhase('ask');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'ready') loadPlaces(center, radiusKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, center.lat, center.lon, radiusKm]);

  // traza la ruta dentro de la app desde tu ubicación (o la de ejemplo) hasta el lugar
  const showRoute = async (p: MapPlace) => {
    setRouting(true);
    logEvent('como_llegar', p.kind);
    const r = await fetchRoute(center, p);
    setRoute({ ...r, to: p.id });
    setRouting(false);
  };
  // navegación paso a paso en la app de mapas del teléfono
  const navigate = (p: LatLon) => {
    logEvent('navegacion_externa');
    Linking.openURL(directionsUrl(p)).catch(() => {});
  };
  const activeRoute = route && route.to === selected ? route : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PlacesMap
        center={center}
        user={user}
        places={shown}
        selectedId={selected}
        onSelect={(id) => {
          setSelected(id);
          if (id !== route?.to) setRoute(null);
          if (id) logEvent('lugar_mapa', id.startsWith('v-') ? 'visita' : 'cercano');
        }}
        radiusKm={radiusKm}
        recenterKey={recenter}
        route={activeRoute?.coords ?? null}
        routeApprox={activeRoute?.approx}
      />

      {/* barra superior flotante */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, gap: space.sm }}>
        <View style={[styles.row, { gap: space.sm }]}>
          <Fab icon="chevron-back" label="Volver" onPress={() => goBack('/')} />
          <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 44 }, shadow.card]}>
            <Ionicons name="search" size={18} color={colors.inkMuted} />
            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                if (t) setFilter('todo');
              }}
              placeholder="Buscar consultorios, clínicas, médicos…"
              placeholderTextColor={colors.inkSubtle}
              style={[{ flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.ink, paddingVertical: 10 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              accessibilityLabel="Buscar en el mapa"
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} accessibilityLabel="Borrar búsqueda" hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.inkSubtle} />
              </Pressable>
            ) : null}
          </View>
          {loadingPlaces ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
        <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 11, color: colors.inkMuted }} numberOfLines={1}>
            {phase === 'ask'
              ? 'Esperando permiso de ubicación'
              : phase === 'locating'
                ? 'Buscando tu ubicación…'
                : usingSample
                  ? 'Ubicación de ejemplo: Guayaquil'
                  : 'Mostrando tu ubicación actual'}
            {loadingPlaces ? ' · buscando lugares…' : source === 'osm' ? ' · lugares de OpenStreetMap' : source === 'ejemplo' ? ' · lugares de ejemplo' : ''}
          </Text>
        </View>
      </View>

      {/* botones laterales */}
      <View pointerEvents="box-none" style={{ position: 'absolute', right: space.md, top: insets.top + 150, gap: space.sm, alignItems: 'flex-end' }}>
        <Fab
          icon="locate"
          label="Volver a mi ubicación"
          onPress={() => {
            setSelected(null);
            if (usingSample) locate();
            else setRecenter((n) => n + 1);
          }}
        />
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 4, gap: 2 }, shadow.card]}>
          {RADII.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRadiusKm(r)}
              accessibilityRole="button"
              accessibilityLabel={`Radio de ${r} kilómetros`}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: radiusKm === r ? colors.primary : 'transparent' }}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: radiusKm === r ? colors.white : colors.ink }}>{r} km</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            logEvent('google_maps_abierto');
            router.push(user ? { pathname: '/mapa-google', params: { lat: String(user.lat), lon: String(user.lon) } } : '/mapa-google');
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver consultorios en Google Maps"
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9, opacity: pressed ? 0.75 : 1 },
            shadow.card,
          ]}
        >
          <Ionicons name="logo-google" size={16} color={colors.primary} />
          <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.ink }}>Google Maps</Text>
        </Pressable>
      </View>

      {/* panel inferior: lugar seleccionado o lista de cercanos */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + space.md }}>
        {denied && phase === 'ready' ? (
          <View style={[{ marginHorizontal: space.md, marginBottom: space.sm, backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm }]}>
            <Ionicons name="location-outline" size={18} color={colors.warning} />
            <Text style={[type.caption, { color: colors.warning, flex: 1 }]}>
              No tenemos acceso a tu ubicación. Te mostramos una zona de ejemplo.
            </Text>
            <Pressable onPress={() => (Platform.OS === 'web' ? locate() : Linking.openSettings())} hitSlop={6}>
              <Text style={[type.label, { color: colors.warning }]}>{Platform.OS === 'web' ? 'Reintentar' : 'Ajustes'}</Text>
            </Pressable>
          </View>
        ) : null}

        {sel ? (
          <Animated.View
            style={[
              {
                marginHorizontal: space.md,
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: space.lg,
                gap: space.sm,
                opacity: sheet,
                transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
              shadow.card,
            ]}
          >
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <View style={[styles.row, { gap: 6 }]}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: KIND_STYLE[sel.kind].color }} />
                <Text style={type.overline}>{KIND_STYLE[sel.kind].label}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} accessibilityLabel="Cerrar" hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.inkMuted} />
              </Pressable>
            </View>
            <Text style={type.h2}>{sel.name}</Text>
            <Text style={type.bodyMuted}>
              {formatDistance(distanceKm(center, sel))} {usingSample ? 'del punto de ejemplo' : 'de ti'}
              {sel.subtitle ? ` · ${sel.subtitle}` : ''}
            </Text>
            {activeRoute ? (
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, gap: 4 }}>
                <View style={[styles.row, { gap: space.lg }]}>
                  <View style={[styles.row, { gap: 6 }]}>
                    <Ionicons name="car-outline" size={18} color={colors.primary} />
                    <Text style={type.h3}>{formatMinutes(activeRoute.driveMin)}</Text>
                  </View>
                  <View style={[styles.row, { gap: 6 }]}>
                    <Ionicons name="walk-outline" size={18} color={colors.primary} />
                    <Text style={type.h3}>{formatMinutes(activeRoute.walkMin)}</Text>
                  </View>
                  <Text style={type.bodyMuted}>{formatDistance(activeRoute.distanceKm)}</Text>
                </View>
                {activeRoute.approx ? (
                  <Text style={type.caption}>Ruta aproximada: sin conexión al servicio de rutas, se muestra la dirección en línea recta.</Text>
                ) : null}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
              <View style={{ flex: 1 }}>
                {activeRoute ? (
                  <Button label="Navegar" icon="navigate" small onPress={() => navigate(sel)} />
                ) : (
                  <Button label="Cómo llegar" icon="git-branch-outline" small loading={routing} onPress={() => showRoute(sel)} />
                )}
              </View>
              {activeRoute ? (
                <View style={{ flex: 1 }}>
                  <Button label="Quitar ruta" variant="secondary" icon="close" small onPress={() => setRoute(null)} />
                </View>
              ) : null}
              {sel.visitId && !activeRoute ? (
                <View style={{ flex: 1 }}>
                  <Button label="Abrir visita" variant="secondary" icon="calendar-outline" small onPress={() => router.push(`/visita/${sel.visitId}`)} />
                </View>
              ) : null}
            </View>
          </Animated.View>
        ) : phase === 'ready' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}>
            {shown.slice(0, 12).map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setSelected(p.id)}
                accessibilityRole="button"
                style={[{ width: 210, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: 4 }, shadow.card]}
              >
                <View style={[styles.row, { gap: 6 }]}>
                  <Ionicons name={KIND_STYLE[p.kind].icon} size={14} color={KIND_STYLE[p.kind].color} />
                  <Text style={[type.caption, { color: KIND_STYLE[p.kind].color }]}>{KIND_STYLE[p.kind].label}</Text>
                  <Text style={[type.caption, { marginLeft: 'auto' }]}>{formatDistance(p.km)}</Text>
                </View>
                <Text style={type.label} numberOfLines={2}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
            {shown.length === 0 && !loadingPlaces ? (
              <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md }, shadow.card]}>
                <Text style={type.bodyMuted}>No hay lugares de este tipo en el radio elegido.</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </View>

      {/* explicación antes de pedir el permiso de ubicación */}
      {phase === 'ask' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, justifyContent: 'flex-end' }]}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.md }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="location" size={30} color={colors.primary} />
            </View>
            <Text style={type.h2}>Activa tu ubicación</Text>
            <Text style={type.body}>
              Multi LAB usa tu ubicación solo mientras usas el mapa, para mostrarte los consultorios, clínicas y hospitales cercanos y ordenar tus visitas por distancia.
            </Text>
            <Button label="Permitir ubicación" icon="navigate" onPress={locate} />
            <Button label="Ahora no, usar zona de ejemplo" variant="ghost" onPress={fallbackToSample} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Fab({ icon, label, onPress }: { icon: 'chevron-back' | 'locate'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
        shadow.card,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}
