import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import { Button, goBack } from '@/components/ui';
import { personById, productById, type IconName } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

interface Page {
  kind: 'cover' | 'slide' | 'end';
  title: string;
  body?: string;
  icon?: IconName;
}

// Modo presentación a pantalla completa para usar frente al profesional de salud
export default function Presentacion() {
  const { id, visita } = useLocalSearchParams<{ id: string; visita?: string }>();
  const { visits, logEvent, setVisitStatus } = useMine();
  const visit = visits.find((v) => v.id === visita);
  const [productId, setProductId] = useState(id);
  const p = productById(productId);
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [share, setShare] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pager = useRef<ScrollView>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const started = useRef(Date.now());

  useEffect(() => {
    logEvent('presentacion_iniciada', productId);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [logEvent, productId]);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [index, productId, anim]);

  if (!p) return null;

  const pages: Page[] = [
    { kind: 'cover', title: p.name, body: p.tagline },
    ...p.slides.map((s) => ({ kind: 'slide' as const, title: s.title, body: s.body, icon: s.icon })),
    { kind: 'end', title: '¿Qué sigue?' },
  ];

  const go = (i: number) => {
    const n = Math.max(0, Math.min(pages.length - 1, i));
    setIndex(n);
    pager.current?.scrollTo({ x: n * width, animated: true });
  };

  const close = () => {
    logEvent('presentacion_cerrada', `${p.id} · ${elapsed}s`);
    goBack('/visitador');
  };

  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      {/* barra superior */}
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {pages.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= index ? colors.turquesa : 'rgba(255,255,255,0.2)' }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar presentación" hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
          <Text style={{ fontFamily: font.semibold, color: '#B9CCD0', fontSize: 12 }}>
            {index + 1}/{pages.length} · {mm}
          </Text>
          <Pressable onPress={() => setShare(true)} accessibilityRole="button" accessibilityLabel="Compartir ficha" hitSlop={10}>
            <Ionicons name="share-social-outline" size={22} color={colors.white} />
          </Pressable>
        </View>
        {visit && visit.productIds.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {visit.productIds.map((pid) => (
              <Pressable
                key={pid}
                onPress={() => {
                  setProductId(pid);
                  setIndex(0);
                  pager.current?.scrollTo({ x: 0, animated: false });
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radius.pill,
                  backgroundColor: pid === productId ? colors.turquesa : 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ fontFamily: font.semibold, fontSize: 12, color: pid === productId ? colors.ink : colors.white }}>
                  {productById(pid)?.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {pages.map((pg, i) => (
          <View key={`${p.id}-${i}`} style={{ width, padding: space.xl, justifyContent: 'center', gap: space.xl }}>
            <Animated.View style={{ gap: space.lg, opacity: i === index ? anim : 1, transform: [{ translateY: i === index ? translateY : 0 }] }}>
              {pg.kind === 'cover' ? (
                <>
                  <ProductVisual product={p} height={Math.min(300, height * 0.36)} />
                  <Text style={[type.overline, { color: colors.turquesa }]}>
                    {p.category} · {p.lab} (ficticio)
                  </Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 32, lineHeight: 38, color: colors.white }}>{pg.title}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 18, lineHeight: 26, color: '#D5E2E5' }}>{pg.body}</Text>
                </>
              ) : pg.kind === 'slide' ? (
                <>
                  <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={pg.icon ?? 'sparkles-outline'} size={48} color={colors.white} />
                  </View>
                  <Text style={{ fontFamily: font.bold, fontSize: 30, lineHeight: 36, color: colors.white }}>{pg.title}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 19, lineHeight: 28, color: '#D5E2E5' }}>{pg.body}</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontFamily: font.bold, fontSize: 30, color: colors.white }}>{pg.title}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: '#D5E2E5' }}>
                    Continúa la visita sin salir de la app.
                  </Text>
                  <View style={{ gap: space.sm }}>
                    <Button label="Compartir ficha por chat" icon="send-outline" onPress={() => setShare(true)} />
                    <Button label="Ver ficha completa" variant="secondary" icon="document-text-outline" onPress={() => router.push(`/producto/${p.id}`)} />
                    {visit && visit.status !== 'Realizada' ? (
                      <Button
                        label={`Marcar visita con ${personById(visit.doctorId).name} como realizada`}
                        variant="secondary"
                        icon="checkmark-done-outline"
                        onPress={() => {
                          setVisitStatus(visit.id, 'Realizada');
                          router.replace(`/visita/${visit.id}`);
                        }}
                      />
                    ) : null}
                  </View>
                  <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#8FA7AD' }}>
                    Contenido de demostración. No corresponde a material promocional real.
                  </Text>
                </>
              )}
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      {/* controles inferiores */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.lg }}>
        <Pressable
          onPress={() => go(index - 1)}
          disabled={index === 0}
          accessibilityRole="button"
          accessibilityLabel="Anterior"
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', opacity: index === 0 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </Pressable>
        <Pressable
          onPress={() => go(index + 1)}
          disabled={index === pages.length - 1}
          accessibilityRole="button"
          accessibilityLabel="Siguiente"
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.turquesa, alignItems: 'center', justifyContent: 'center', opacity: index === pages.length - 1 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-forward" size={26} color={colors.ink} />
        </Pressable>
      </View>

      <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
    </SafeAreaView>
  );
}
